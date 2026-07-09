// Rater expression language — tokenizer, Pratt parser, evaluator.
//
// A deliberately small, safe, side-effect-free language for rater conditions
// and formulas. No eval / new Function; the same code runs in Deno edge
// functions and the browser.
//
//   Literals:    123  1_000 is NOT supported  'strings'  true false null
//   Identifiers: dot paths — inputs.state, base_rate.rate
//   Operators:   ?:  or  and  not  == != < <= > >=  + -  * / %  unary -  (...)
//   Functions:   whitelist only (min, max, round, coalesce, if, ...)
//
// Semantics: numbers are IEEE doubles (round money explicitly via
// round(x, 2)); arithmetic or ordered comparison on null / non-numbers throws
// an ExprError naming the operand — never a silent NaN. Only == / != accept
// null.

export class ExprError extends Error {
  constructor(
    message: string,
    readonly pos?: number,
  ) {
    super(message);
    this.name = 'ExprError';
  }
}

// --- tokens --------------------------------------------------------------------

type TokenType =
  | 'number'
  | 'string'
  | 'ident' // dot path, keywords resolved by the parser
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'question'
  | 'colon'
  | 'eof';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const IDENT_START = /[a-zA-Z_]/;
const IDENT_CHAR = /[a-zA-Z0-9_]/;
const OPS = ['==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '%'];

const tokenize = (src: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1;
      continue;
    }

    if (ch >= '0' && ch <= '9') {
      const start = i;
      while (i < src.length && src[i] >= '0' && src[i] <= '9') i += 1;
      if (src[i] === '.' && src[i + 1] >= '0' && src[i + 1] <= '9') {
        i += 1;
        while (i < src.length && src[i] >= '0' && src[i] <= '9') i += 1;
      }
      tokens.push({ type: 'number', value: src.slice(start, i), pos: start });
      continue;
    }

    if (ch === "'") {
      const start = i;
      i += 1;
      let value = '';
      let closed = false;
      while (i < src.length) {
        if (src[i] === "'") {
          if (src[i + 1] === "'") {
            value += "'";
            i += 2;
            continue;
          }
          closed = true;
          i += 1;
          break;
        }
        value += src[i];
        i += 1;
      }
      if (!closed) throw new ExprError('unterminated string', start);
      tokens.push({ type: 'string', value, pos: start });
      continue;
    }

    if (IDENT_START.test(ch)) {
      const start = i;
      while (i < src.length && IDENT_CHAR.test(src[i])) i += 1;
      // dot path: ident(.ident)*
      while (src[i] === '.' && src[i + 1] !== undefined && IDENT_START.test(src[i + 1])) {
        i += 1;
        while (i < src.length && IDENT_CHAR.test(src[i])) i += 1;
      }
      tokens.push({ type: 'ident', value: src.slice(start, i), pos: start });
      continue;
    }

    const two = src.slice(i, i + 2);
    if (OPS.includes(two)) {
      tokens.push({ type: 'op', value: two, pos: i });
      i += 2;
      continue;
    }
    if (OPS.includes(ch)) {
      tokens.push({ type: 'op', value: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === '?') {
      tokens.push({ type: 'question', value: ch, pos: i });
      i += 1;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon', value: ch, pos: i });
      i += 1;
      continue;
    }

    throw new ExprError(`unexpected character '${ch}'`, i);
  }

  tokens.push({ type: 'eof', value: '', pos: src.length });
  return tokens;
};

// --- AST -----------------------------------------------------------------------

export type ExprNode =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'null' }
  | { kind: 'ref'; path: string[] } // ['inputs','state'] or ['base_rate','rate']
  | { kind: 'unary'; op: '-' | 'not'; operand: ExprNode }
  | { kind: 'binary'; op: string; left: ExprNode; right: ExprNode }
  | { kind: 'ternary'; cond: ExprNode; then: ExprNode; else: ExprNode }
  | { kind: 'call'; name: string; args: ExprNode[] };

// Binding power (precedence), low → high. Left-associative binaries bind the
// right side at bp + 1.
const BINARY_BP: Record<string, number> = {
  or: 2,
  and: 3,
  '==': 5,
  '!=': 5,
  '<': 5,
  '<=': 5,
  '>': 5,
  '>=': 5,
  '+': 6,
  '-': 6,
  '*': 7,
  '/': 7,
  '%': 7,
};

const TERNARY_BP = 1;
const NOT_BP = 4;
const UNARY_MINUS_BP = 8;

class Parser {
  private i = 0;
  constructor(private tokens: Token[]) {}

  parse(): ExprNode {
    const node = this.expr(0);
    const t = this.peek();
    if (t.type !== 'eof') {
      throw new ExprError(`unexpected '${t.value}'`, t.pos);
    }
    return node;
  }

  private peek(): Token {
    return this.tokens[this.i];
  }

  private next(): Token {
    return this.tokens[this.i++];
  }

  private expect(type: TokenType, what: string): Token {
    const t = this.next();
    if (t.type !== type) {
      throw new ExprError(`expected ${what}, got '${t.value || 'end of expression'}'`, t.pos);
    }
    return t;
  }

  private expr(minBp: number): ExprNode {
    let left = this.prefix();

    for (;;) {
      const t = this.peek();

      if (t.type === 'question' && TERNARY_BP >= minBp) {
        this.next();
        const thenBranch = this.expr(0);
        this.expect('colon', "':'");
        const elseBranch = this.expr(TERNARY_BP); // right-associative
        left = { kind: 'ternary', cond: left, then: thenBranch, else: elseBranch };
        continue;
      }

      const op =
        t.type === 'op' ? t.value : t.type === 'ident' && (t.value === 'and' || t.value === 'or') ? t.value : null;
      if (op === null) break;
      const bp = BINARY_BP[op];
      if (bp === undefined || bp < minBp) break;

      this.next();
      const right = this.expr(bp + 1);
      left = { kind: 'binary', op, left, right };
    }

    return left;
  }

  private prefix(): ExprNode {
    const t = this.next();

    switch (t.type) {
      case 'number':
        return { kind: 'number', value: Number(t.value) };
      case 'string':
        return { kind: 'string', value: t.value };
      case 'lparen': {
        const inner = this.expr(0);
        this.expect('rparen', "')'");
        return inner;
      }
      case 'op':
        if (t.value === '-') {
          return { kind: 'unary', op: '-', operand: this.expr(UNARY_MINUS_BP) };
        }
        throw new ExprError(`unexpected '${t.value}'`, t.pos);
      case 'ident': {
        if (t.value === 'true') return { kind: 'boolean', value: true };
        if (t.value === 'false') return { kind: 'boolean', value: false };
        if (t.value === 'null') return { kind: 'null' };
        if (t.value === 'not') {
          return { kind: 'unary', op: 'not', operand: this.expr(NOT_BP) };
        }
        if (t.value === 'and' || t.value === 'or') {
          throw new ExprError(`unexpected '${t.value}'`, t.pos);
        }
        // function call — plain name followed by '('
        if (!t.value.includes('.') && this.peek().type === 'lparen') {
          this.next();
          const args: ExprNode[] = [];
          if (this.peek().type !== 'rparen') {
            for (;;) {
              args.push(this.expr(0));
              if (this.peek().type === 'comma') {
                this.next();
                continue;
              }
              break;
            }
          }
          this.expect('rparen', "')'");
          return { kind: 'call', name: t.value, args };
        }
        return { kind: 'ref', path: t.value.split('.') };
      }
      default:
        throw new ExprError(
          t.type === 'eof' ? 'unexpected end of expression' : `unexpected '${t.value}'`,
          t.pos,
        );
    }
  }
}

export const parse = (src: string): ExprNode => new Parser(tokenize(src)).parse();

// --- evaluation ------------------------------------------------------------------

export type Scope = Record<string, unknown>;

const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const describe = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return `'${v}'`;
  if (Array.isArray(v)) return 'a list';
  if (typeof v === 'object') return 'an object';
  return String(v);
};

const asNumber = (v: unknown, context: string): number => {
  if (isNumber(v)) return v;
  throw new ExprError(`${context} needs a number, got ${describe(v)}`);
};

const truthy = (v: unknown, context: string): boolean => {
  if (typeof v === 'boolean') return v;
  throw new ExprError(`${context} needs a boolean (true/false), got ${describe(v)}`);
};

const looseEquals = (a: unknown, b: unknown): boolean => {
  const an = a === undefined ? null : a;
  const bn = b === undefined ? null : b;
  if (an === null || bn === null) return an === bn;
  // case-insensitive string equality (matches lookup exact-match semantics)
  if (typeof an === 'string' && typeof bn === 'string') {
    return an.toLowerCase() === bn.toLowerCase();
  }
  return an === bn;
};

const FUNCTIONS: Record<string, (args: unknown[]) => unknown> = {
  min: (args) => Math.min(...args.map((a, i) => asNumber(a, `min() argument ${i + 1}`))),
  max: (args) => Math.max(...args.map((a, i) => asNumber(a, `max() argument ${i + 1}`))),
  abs: ([x]) => Math.abs(asNumber(x, 'abs()')),
  round: ([x, dp]) => {
    const places = dp === undefined ? 0 : asNumber(dp, 'round() decimal places');
    const f = 10 ** places;
    return Math.round(asNumber(x, 'round()') * f) / f;
  },
  floor: ([x]) => Math.floor(asNumber(x, 'floor()')),
  ceil: ([x]) => Math.ceil(asNumber(x, 'ceil()')),
  clamp: ([x, lo, hi]) =>
    Math.min(Math.max(asNumber(x, 'clamp()'), asNumber(lo, 'clamp() low')), asNumber(hi, 'clamp() high')),
  coalesce: (args) => args.find((a) => a !== null && a !== undefined) ?? null,
  if: ([c, a, b]) => (truthy(c, 'if() condition') ? a : b),
  concat: (args) => args.map((a) => (a === null || a === undefined ? '' : String(a))).join(''),
  upper: ([x]) => String(x ?? '').toUpperCase(),
  lower: ([x]) => String(x ?? '').toLowerCase(),
  len: ([x]) => {
    if (typeof x === 'string') return x.length;
    if (Array.isArray(x)) return x.length;
    throw new ExprError(`len() needs a string or list, got ${describe(x)}`);
  },
  contains: ([coll, v]) => {
    if (typeof coll === 'string') return coll.toLowerCase().includes(String(v ?? '').toLowerCase());
    if (Array.isArray(coll)) return coll.some((item) => looseEquals(item, v));
    throw new ExprError(`contains() needs a string or list, got ${describe(coll)}`);
  },
  number: ([x]) => {
    if (isNumber(x)) return x;
    if (typeof x === 'string' && x.trim() !== '') {
      const n = Number(x);
      if (Number.isFinite(n)) return n;
    }
    if (typeof x === 'boolean') return x ? 1 : 0;
    throw new ExprError(`number() can't convert ${describe(x)}`);
  },
  string: ([x]) => (x === null || x === undefined ? '' : String(x)),
};

const FUNCTION_ARITY: Record<string, [number, number]> = {
  min: [1, 99],
  max: [1, 99],
  abs: [1, 1],
  round: [1, 2],
  floor: [1, 1],
  ceil: [1, 1],
  clamp: [3, 3],
  coalesce: [1, 99],
  if: [3, 3],
  concat: [1, 99],
  upper: [1, 1],
  lower: [1, 1],
  len: [1, 1],
  contains: [2, 2],
  number: [1, 1],
  string: [1, 1],
};

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

const resolveRef = (path: string[], scope: Scope): unknown => {
  const [head, ...rest] = path;
  if (!(head in scope)) {
    throw new ExprError(`unknown name '${head}'`);
  }
  let current: unknown = scope[head];
  for (const key of rest) {
    if (current === null || current === undefined) {
      throw new ExprError(`'${path.join('.')}': '${head}' has no value to read '${key}' from`);
    }
    if (typeof current !== 'object' || Array.isArray(current)) {
      throw new ExprError(`'${path.join('.')}': can't read '${key}' from ${describe(current)}`);
    }
    if (!(key in (current as Record<string, unknown>))) {
      throw new ExprError(`'${path.join('.')}': no field '${key}'`);
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current === undefined ? null : current;
};

export const evaluate = (node: ExprNode, scope: Scope): unknown => {
  switch (node.kind) {
    case 'number':
    case 'string':
    case 'boolean':
      return node.value;
    case 'null':
      return null;
    case 'ref':
      return resolveRef(node.path, scope);
    case 'unary': {
      if (node.op === 'not') return !truthy(evaluate(node.operand, scope), "'not'");
      return -asNumber(evaluate(node.operand, scope), "unary '-'");
    }
    case 'ternary':
      return truthy(evaluate(node.cond, scope), "'?:' condition")
        ? evaluate(node.then, scope)
        : evaluate(node.else, scope);
    case 'binary': {
      const { op } = node;
      if (op === 'and') {
        return truthy(evaluate(node.left, scope), "'and'") && truthy(evaluate(node.right, scope), "'and'");
      }
      if (op === 'or') {
        return truthy(evaluate(node.left, scope), "'or'") || truthy(evaluate(node.right, scope), "'or'");
      }
      const left = evaluate(node.left, scope);
      const right = evaluate(node.right, scope);
      switch (op) {
        case '==':
          return looseEquals(left, right);
        case '!=':
          return !looseEquals(left, right);
        case '<':
        case '<=':
        case '>':
        case '>=': {
          // ordered comparison: numbers, or strings (locale-free)
          if (typeof left === 'string' && typeof right === 'string') {
            if (op === '<') return left < right;
            if (op === '<=') return left <= right;
            if (op === '>') return left > right;
            return left >= right;
          }
          const l = asNumber(left, `'${op}' left side`);
          const r = asNumber(right, `'${op}' right side`);
          if (op === '<') return l < r;
          if (op === '<=') return l <= r;
          if (op === '>') return l > r;
          return l >= r;
        }
        case '+': {
          if (typeof left === 'string' || typeof right === 'string') {
            throw new ExprError("'+' is numeric only — use concat() to join text");
          }
          return asNumber(left, "'+' left side") + asNumber(right, "'+' right side");
        }
        case '-':
          return asNumber(left, "'-' left side") - asNumber(right, "'-' right side");
        case '*':
          return asNumber(left, "'*' left side") * asNumber(right, "'*' right side");
        case '/': {
          const divisor = asNumber(right, "'/' right side");
          if (divisor === 0) throw new ExprError('division by zero');
          return asNumber(left, "'/' left side") / divisor;
        }
        case '%': {
          const m = asNumber(right, "'%' right side");
          if (m === 0) throw new ExprError('modulo by zero');
          return asNumber(left, "'%' left side") % m;
        }
        default:
          throw new ExprError(`unknown operator '${op}'`);
      }
    }
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) {
        throw new ExprError(
          `unknown function '${node.name}' (available: ${FUNCTION_NAMES.join(', ')})`,
        );
      }
      const [minArgs, maxArgs] = FUNCTION_ARITY[node.name];
      if (node.args.length < minArgs || node.args.length > maxArgs) {
        throw new ExprError(
          `${node.name}() takes ${minArgs === maxArgs ? minArgs : `${minArgs}–${maxArgs}`} argument(s), got ${node.args.length}`,
        );
      }
      // if() is lazily evaluated on the taken side; everything else is strict.
      if (node.name === 'if') {
        const cond = truthy(evaluate(node.args[0], scope), 'if() condition');
        return evaluate(cond ? node.args[1] : node.args[2], scope);
      }
      return fn(node.args.map((a) => evaluate(a, scope)));
    }
  }
};

/** Convenience: parse + evaluate in one call. */
export const evaluateExpr = (src: string, scope: Scope): unknown =>
  evaluate(parse(src), scope);

/**
 * Top-level binding names referenced by an expression (first path segment of
 * every ref). Drives static validation, editor autocomplete, and diagram
 * data-edges. `inputs` refs are returned as `inputs.<name>`.
 */
export const referencedBindings = (node: ExprNode): Set<string> => {
  const refs = new Set<string>();
  const walk = (n: ExprNode): void => {
    switch (n.kind) {
      case 'ref':
        refs.add(n.path[0] === 'inputs' && n.path.length > 1 ? `inputs.${n.path[1]}` : n.path[0]);
        break;
      case 'unary':
        walk(n.operand);
        break;
      case 'binary':
        walk(n.left);
        walk(n.right);
        break;
      case 'ternary':
        walk(n.cond);
        walk(n.then);
        walk(n.else);
        break;
      case 'call':
        for (const a of n.args) walk(a);
        break;
      default:
        break;
    }
  };
  walk(node);
  return refs;
};
