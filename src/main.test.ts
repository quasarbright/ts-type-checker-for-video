import { Bool, Call, check, Context, Eq, Fun, If, infer, Let, LetFun, Num, Or, Plus, Type, Var } from "./main"

describe('type checker', () => {
const empty: Context = new Map()

  test('num', () => {
    expect(infer(empty, new Num(42))).toBe('Number')
  })

  test('bool', () => {
    expect(infer(empty, new Bool(true))).toBe('Boolean')
    expect(infer(empty, new Bool(false))).toBe('Boolean')
  })

  test('var', () => {
    const ctx = new Map<string, Type>([['x', 'Number']])
    const expr = new Var('x')
    expect(infer(ctx, expr)).toBe('Number')
  })

  test('unbound var', () => {
    expect(() => infer(empty, new Var('x'))).toThrow(
      'Unbound variable: x'
    )
  })

  test('let and var', () => {
    // let x = 5 in x
    const expr = new Let('x', new Num(5), new Var('x'))
    expect(infer(empty, expr)).toBe('Number')
  })

  test('shadowing', () => {
    // let x = 5 in let x = true in x
    const expr = new Let('x', new Num(5), new Let('x', new Bool(true), new Var('x')))
    expect(infer(empty, expr)).toBe('Boolean')
  })

  test('environment extension is non-mutating', () => {
    // (let x = 1 in x) + x
    const expr = new Plus(
      new Let('x', new Num(1), new Var('x')),
      new Var('x'),
    )
    expect(() => infer(empty, expr)).toThrow(
      'Unbound variable: x'
    )
  })

  test('plus', () => {
    const expr = new Plus(new Num(1), new Num(2))
    expect(infer(empty, expr)).toBe('Number')
  })

  test('plus with bool', () => {
    const expr = new Plus(new Num(1), new Bool(true))
    expect(() => infer(empty, expr)).toThrow(
      'Type mismatch: expected a \"Number\", but got a \"Boolean\"'
    )
  })

  test('or', () => {
    const expr = new Or(new Bool(true), new Bool(false))
    expect(infer(empty, expr)).toBe('Boolean')
  })

  test('or with number', () => {
    const expr = new Or(new Bool(true), new Num(1))
    expect(() => infer(empty, expr)).toThrow(
      'Type mismatch: expected a \"Boolean\", but got a \"Number\"'
    )
  })

  test('eq', () => {
    const expr = new Eq(new Num(1), new Num(1))
    expect(infer(empty, expr)).toBe('Boolean')
  })

  test('eq with bool and number', () => {
    const expr = new Eq(new Bool(true), new Num(1))
    expect(() => infer(empty, expr)).toThrow(
      'Type mismatch: expected a \"Boolean\", but got a \"Number\"'
    )
  })

  test('fun', () => {
    // fun (x : Number) -> x
    const expr = new Fun('x', 'Number', new Var('x'))
    expect(infer(empty, expr)).toEqual({ tArg: 'Number', tRet: 'Number' })
  })

  test('call', () => {
    // (fun (x : Number) -> x)(1)
    const expr = new Call(
      new Fun('x', 'Number', new Var('x')),
      new Num(1),
    )
    expect(infer(empty, expr)).toBe('Number')
  })

  test('call with wrong arg type', () => {
    // (fun (x : Number) -> x)(true)
    const expr = new Call(
      new Fun('x', 'Number', new Var('x')),
      new Bool(true),
    )
    expect(() => infer(empty, expr)).toThrow(
      'Type mismatch: expected a \"Number\", but got a \"Boolean\"'
    )
  })

  test('call with non-function', () => {
    // 1(1)
    const expr = new Call(new Num(1), new Num(1))
    expect(() => infer(empty, expr)).toThrow(
      'Type mismatch: expected a function, but got a \"Number\"'
    )
  })

  test('letfun', () => {
    // letfun sumTo10(x : Number): Number -> if x == 10 then x else x + sumTo10(x + 1)
    // in sumTo10(8)
     const body = new If(
      new Eq(new Var('x'), new Num(10)),
      new Var('x'),
      new Plus(
        new Var('x'),
        new Call(new Var('sumTo10'), new Plus(new Var('x'), new Num(1))),
      ),
    )
    const letfun = new LetFun(
      'sumTo10',
      'x',
      'Number',
      'Number',
      body,
      new Call(new Var('sumTo10'), new Num(8))
    )
    expect(infer(empty, letfun)).toBe('Number')
  })

  test('letfun with wrong body type', () => {
    // letfun sumTo10(x : Number): Number -> if x == 10 then x else x + sumTo10(x + 1)
    // in sumTo10(8)
     const body = new Bool(true)
     const letfun = new LetFun(
      'sumTo10',
      'x',
      'Number',
      'Number',
      body,
      new Call(new Var('sumTo10'), new Num(8))
    )
    expect(() => infer(empty, letfun)).toThrow(
      'Type mismatch: expected a \"Number\", but got a \"Boolean\"'
    )
  })

  test('function type equality success', () => {
    // fun (x : Number) -> x <= Number -> Number
    const expr = new Fun('x', 'Number', new Var('x'))
    const expectedType = { tArg: 'Number', tRet: 'Number' } as Type
    check(empty, expr, expectedType)
  })

  test('function type equality fail', () => {
    // fun (x : Number) -> x <= Boolean -> Boolean
    const expr = new Fun('x', 'Number', new Var('x'))
    const expectedType = { tArg: 'Boolean', tRet: 'Boolean' } as Type
    expect(() => check(empty, expr, expectedType)).toThrow(
      'Type mismatch: expected a {\"tArg\":\"Boolean\",\"tRet\":\"Boolean\"}, but got a {\"tArg\":\"Number\",\"tRet\":\"Number\"}'
    )
  })
})