import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { evaluateExpr, ExprError, parse, referencedBindings } from './expr.ts';

const run = (src: string, scope: Record<string, unknown> = {}) =>
  evaluateExpr(src, scope);

Deno.test('arithmetic precedence and parens', () => {
  assertEquals(run('2 + 3 * 4'), 14);
  assertEquals(run('(2 + 3) * 4'), 20);
  assertEquals(run('10 - 4 - 3'), 3); // left-associative
  assertEquals(run('2 * 3 % 4'), 2);
  assertEquals(run('-2 * 3'), -6);
  assertEquals(run('-(2 + 3)'), -5);
  assertEquals(run('10 / 4'), 2.5);
});

Deno.test('comparisons and equality', () => {
  assertEquals(run('3 < 4'), true);
  assertEquals(run('4 <= 4'), true);
  assertEquals(run('5 > 6'), false);
  assertEquals(run("'NY' == 'ny'"), true); // case-insensitive text equality
  assertEquals(run("'NY' != 'CA'"), true);
  assertEquals(run('null == null'), true);
  assertEquals(run('1 == null'), false);
  assertEquals(run("'b' > 'a'"), true); // string ordering allowed
});

Deno.test('boolean logic and ternary', () => {
  assertEquals(run('true and false'), false);
  assertEquals(run('true or false'), true);
  assertEquals(run('not false'), true);
  assertEquals(run('1 < 2 and 3 < 4 or false'), true);
  assertEquals(run("1 < 2 ? 'yes' : 'no'"), 'yes');
  assertEquals(run('false ? 1 : true ? 2 : 3'), 2); // right-associative
});

Deno.test('short-circuit: and/or do not evaluate the other side', () => {
  // x.y would throw (unknown name) if evaluated
  assertEquals(run('false and missing > 1'), false);
  assertEquals(run('true or missing > 1'), true);
});

Deno.test('dot-path references into scope', () => {
  const scope = {
    inputs: { state: 'NY', asset_value: 25000000 },
    base_rate: { rate: 0.0008 },
  };
  assertEquals(run('inputs.state', scope), 'NY');
  assertEquals(run('inputs.asset_value * base_rate.rate', scope), 20000);
});

Deno.test('reference errors are structured and named', () => {
  assertThrows(() => run('missing + 1'), ExprError, "unknown name 'missing'");
  assertThrows(
    () => run('thing.field', { thing: null }),
    ExprError,
    "has no value to read 'field' from",
  );
  assertThrows(
    () => run('thing.nope', { thing: { a: 1 } }),
    ExprError,
    "no field 'nope'",
  );
});

Deno.test('null and type errors: no silent NaN', () => {
  assertThrows(() => run('null + 1'), ExprError, 'needs a number');
  assertThrows(() => run("1 + 'x'"), ExprError, 'numeric only');
  assertThrows(() => run('null < 1'), ExprError, 'needs a number');
  assertThrows(() => run('1 / 0'), ExprError, 'division by zero');
  assertThrows(() => run("not 'x'"), ExprError, 'needs a boolean');
  assertThrows(() => run('1 and true'), ExprError, 'needs a boolean');
});

Deno.test('function whitelist', () => {
  assertEquals(run('min(3, 1, 2)'), 1);
  assertEquals(run('max(3, 1, 2)'), 3);
  assertEquals(run('round(2.5)'), 3);
  assertEquals(run('round(16100.4567, 2)'), 16100.46);
  assertEquals(run('abs(-4)'), 4);
  assertEquals(run('floor(1.9)'), 1);
  assertEquals(run('ceil(1.1)'), 2);
  assertEquals(run('clamp(15, 0, 10)'), 10);
  assertEquals(run('coalesce(null, null, 3)'), 3);
  assertEquals(run("if(2 > 1, 'a', 'b')"), 'a');
  assertEquals(run("concat('a', null, 1)"), 'a1');
  assertEquals(run("upper('ny')"), 'NY');
  assertEquals(run("lower('NY')"), 'ny');
  assertEquals(run("len('abc')"), 3);
  assertEquals(run("contains('New York', 'york')"), true);
  assertEquals(run("number('42')"), 42);
  assertEquals(run('string(42)'), '42');
});

Deno.test('if() is lazy on the untaken side', () => {
  assertEquals(run('if(true, 1, missing + 1)'), 1);
});

Deno.test('unknown function / bad arity', () => {
  assertThrows(() => run('exec(1)'), ExprError, "unknown function 'exec'");
  assertThrows(() => run('abs(1, 2)'), ExprError, 'takes 1 argument');
  assertThrows(() => run('clamp(1)'), ExprError, 'takes 3');
});

Deno.test('string literals with escaped quotes', () => {
  assertEquals(run("'it''s'"), "it's");
  assertThrows(() => run("'unterminated"), ExprError, 'unterminated string');
});

Deno.test('parse errors', () => {
  assertThrows(() => run('1 +'), ExprError, 'unexpected end');
  assertThrows(() => run('(1 + 2'), ExprError, "expected ')'");
  assertThrows(() => run('1 ? 2'), ExprError, "expected ':'");
  assertThrows(() => run('1 2'), ExprError, "unexpected '2'");
  assertThrows(() => run('@'), ExprError, "unexpected character '@'");
  assertThrows(() => run('and 1'), ExprError, "unexpected 'and'");
});

Deno.test('referencedBindings extracts top-level names and inputs.*', () => {
  const ast = parse(
    "inputs.asset_value * base_rate.rate + if(sl_rule != null, 1, 0) - min(x, inputs.state == 'NY' ? 1 : 0)",
  );
  assertEquals(
    [...referencedBindings(ast)].sort(),
    ['base_rate', 'inputs.asset_value', 'inputs.state', 'sl_rule', 'x'],
  );
});
