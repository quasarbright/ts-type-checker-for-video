export type Type = "Number" 
                 | "Boolean" 
                 | { tArg: Type, tRet: Type } // function type
export type Context = Map<string, Type>

/**
 * look up type of variable in context, error if not found.
 * @returns type of variable
 */
function lookup(ctx: Context, x: string) {
  const t = ctx.get(x)
  if (t === undefined) {
    throw Error(`Unbound variable: ${x}`)
  }
  return t!
}

/**
 * (immutably) extend the context with a type annotation x:t.
 * @returns new environment
 */
function extend(ctx: Context, x: string, t: Type): Context {
  // create a copy of ctx
  const extended = new Map(ctx)
  // only mutating the copy
  extended.set(x, t)
  return extended
}

export interface Expr {
  /**
   * infer this expression's type under the given context.
   */
  infer(ctx: Context): Type
}

/**
 * Infer the type of expr under ctx.
 */
export function infer(ctx: Context, expr: Expr): Type {
  return expr.infer(ctx)
}

/**
 * Assert that the expression has the expected type. Error if it doesn't.
 */
export function check(ctx: Context, expr: Expr, expectedType: Type): void {
  /*
  ctx |- e => inferredType    expectedType = inferredType
  ------------------------------------------------------- (CHECK)
  ctx |- e <= expectedType
  */
  const inferredType = infer(ctx, expr)
  if (!sameType(expectedType, inferredType)) {
    throw Error(`Type mismatch: expected a ${JSON.stringify(expectedType)}, but got a ${JSON.stringify(inferredType)}`)
  }
}

/**
 * Are the two types the same?
 * Performs deep structural equality check.
 */
function sameType(t1: Type, t2: Type): boolean {
  if (typeof t1 === "string" || typeof t2 === "string") {
    return t1 === t2
  } else {
    // assumes that the only type objects are function types
    return sameType(t1.tArg, t2.tArg) && sameType(t1.tRet, t2.tRet)
  }
}

export class Num implements Expr {
  readonly num: number

  constructor(num: number) {
    this.num = num
  }

  public infer(ctx: Context): Type {
    /*
    ------------------ (NUM)
    ctx |- n => Number
    */
    return "Number" as const
  }
}

export class Bool implements Expr {
  readonly bool: boolean

  constructor(bool: boolean) {
    this.bool = bool
  }

  public infer(ctx: Context): Type {
    /*
    ---------------------- (TRUE)
    ctx |- true => Boolean


    ----------------------- (FALSE)
    ctx |- false => Boolean
    */
    return "Boolean" as const
  }
}

export class Let implements Expr {
  // let x = e1 in e2
  readonly x: string
  readonly e1: Expr
  readonly e2: Expr
  
  constructor(x: string, e1: Expr, e2: Expr) {
    this.x = x
    this.e1 = e1
    this.e2 = e2
  }

  public infer(ctx: Context): Type {
    /*
    ctx |- e1 => t1    ctx, x:t1 |- e2 => t2
    ---------------------------------------- (LET)
    ctx |- let x = e1 in e2 => t2
    */
    const t1 = infer(ctx, this.e1)
    const extended = extend(ctx, this.x, t1)
    const t2 = infer(extended, this.e2)
    return t2
  }
}

export class Var implements Expr {
  readonly x: string
  constructor(x: string) {
    this.x = x
  }

  public infer(ctx: Context): Type {
    /*
    ctx[x] = t
    ------------- (VAR)
    ctx |- x => t
    */
    return lookup(ctx, this.x)
  }
}

export class Plus implements Expr {
  // left + right
  readonly left: Expr
  readonly right: Expr

  constructor(left: Expr, right: Expr) {
    this.left = left
    this.right = right
  }

  public infer(ctx: Context): Type {
    /*
    ctx |- left <= Number    ctx |- right <= Number
    ----------------------------------------------- (PLUS)
    ctx |- left + right => Number
    */
    check(ctx, this.left, "Number")
    check(ctx, this.right, "Number")
    return "Number"
  }
}

export class Or implements Expr {
  // left || right
  readonly left: Expr
  readonly right: Expr

  constructor(left: Expr, right: Expr) {
    this.left = left
    this.right = right
  }

  public infer(ctx: Context): Type {
    /*
    ctx |- left <= Boolean    ctx |- right <= Boolean
    ------------------------------------------------- (OR)
    ctx |- left || right => Boolean
    */
    check(ctx, this.left, "Boolean")
    check(ctx, this.right, "Boolean")
    return "Boolean"
  }
}

export class Eq implements Expr {
  // left == right
  readonly left: Expr
  readonly right: Expr

  constructor(left: Expr, right: Expr) {
    this.left = left
    this.right = right
  }

  public infer(ctx: Context): Type {
    /*
    ctx |- left =>t    ctx |- right <= t
    ------------------------------------ (EQ)
    ctx |- left == right => Boolean
    */
    const t = infer(ctx, this.left)
    check(ctx, this.right, t)
    return "Boolean"
  }
}

export class If implements Expr {
  readonly condition: Expr
  readonly thenBranch: Expr
  readonly elseBranch: Expr

  constructor(condition: Expr, thenBranch: Expr, elseBranch: Expr) {
    this.condition = condition
    this.thenBranch = thenBranch
    this.elseBranch = elseBranch
  }

  public infer(ctx: Context): Type {
    /*
    ctx |- condition <= Boolean    ctx |- thenBranch => t    ctx |- elseBranch <= t
    ------------------------------------------------------------------------------- (IF)
    ctx |- if condition then thenBranch else elseBranch => t
    */
    check(ctx, this.condition, "Boolean")
    const t = infer(ctx, this.thenBranch)
    check(ctx, this.elseBranch, t)
    return t
  }
}

export class Fun implements Expr {
  // fun (x : tx) -> body
  readonly x: string
  readonly tx: Type
  readonly body: Expr

  constructor(x: string, tx: Type, body: Expr) {
    this.x = x
    this.tx = tx
    this.body = body
  }

  public infer(ctx: Context): Type {
    /*
    ctx, x:tx |- body => tBody
    ----------------------------------------------- (FUN)
    ctx |- fun (x : tx) -> body => tx -> tBody
    */
    const extended = extend(ctx, this.x, this.tx)
    const tBody = infer(extended, this.body)
    return { tArg: this.tx, tRet: tBody }
  }
}

export class Call implements Expr {
  // func(arg)
  readonly func: Expr
  readonly arg: Expr

  constructor(func: Expr, arg: Expr) {
    this.func = func
    this.arg = arg
  }

  public infer(ctx: Context): Type {
    /*
    ctx |- func => tArg -> tRet    ctx |- arg <= tArg
    ------------------------------------------------- (CALL)
    ctx |- func(arg) => tRet
    */
    const tFun = infer(ctx, this.func)
    if (typeof tFun !== "object") {
      throw Error(`Type mismatch: expected a function, but got a ${JSON.stringify(tFun)}`)
    }
    // assuming the only type objects are function types
    const { tArg, tRet } = tFun
    check(ctx, this.arg, tArg)
    return tRet
  }
}

export class LetFun implements Expr {
  // letfun f(x : tx): tRet -> functionBody in letBody
  readonly f: string
  readonly x: string
  readonly tx: Type
  readonly tRet: Type
  readonly functionBody: Expr
  readonly letBody: Expr

  constructor(f: string, x: string, tx: Type, tRet: Type, functionBody: Expr, letBody: Expr) {
    this.f = f
    this.x = x
    this.tx = tx
    this.tRet = tRet
    this.functionBody = functionBody
    this.letBody = letBody
  }

  public infer(ctx: Context): Type {
    /*
    ctx, f:tx -> tRet, x:tx |- functionBody => tRet
    ctx, f:tx -> tRet |- letBody => tLetBody
    -------------------------------------------------------------------- (LETFUN)
    ctx |- letfun f(x : tx): tRet -> functionBody in letBody => tLetBody
    */
    const tf: Type = { tArg: this.tx, tRet: this.tRet }
    const functionBodyContext = extend(extend(ctx, this.f, tf), this.x, this.tx)
    check(functionBodyContext, this.functionBody, this.tRet)

    const letBodyContext = extend(ctx, this.f, tf)
    const tLetBody = infer(letBodyContext, this.letBody)
    return tLetBody
  }
}

