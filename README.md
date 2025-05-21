# ts-type-checker-for-video

this repository contains an example implementation of a type checker, written in typescript.

this type checker is an implementation of the type checker from a YouTube video I made: TODO embed

here is the file structure:

```
src
  skeleton.ts   (starter code)
  main.ts       (full implementation)
  main.test.ts  (tests)
```

If you want to try implementing this yourself, start out with the skeleton and try to implement the `infer` method in each `Expr` class. When you're done, you can change the first line of `src/main.test.ts` to

```typescript
import { Bool, Call, check, Context, Eq, Fun, If, infer, Let, LetFun, Num, Or, Plus, Type, Var } from "./skeleton"
```

to run the tests against your implementation.

## Extending the language

To add new features to the language, extend the `Type` union and/or add new `Expr` classes.

For example, to add ordered pairs to the language, you might do this:

```typescript
export type Type = "Number" 
                 | "Boolean" 
                 | { kind: "function", tArg: Type, tRet: Type } // function type
                 | { kind: "pair", tFst: Type, tSnd: Type} // pair type

...

export class Pair implements Expr {
    // (fst, snd)
    readonly fst: Expr
    readonly snd: Expr
    ...
}

export class Fst implements Expr {
    // fst(pair)
    readonly pair: Expr
}

export class Snd implements Expr {
    // snd(pair)
    readonly pair: Expr
}
```

you'll also have to update `sameType` and other functions which work with types.

the typing rules would be
```
ctx |- fst => tFst    ctx |- snd => tSnd
---------------------------------------- (PAIR)
ctx |- (fst, snd) => (tFst, tSnd)


ctx |- pair => (tFst, tSnd)
--------------------------- (FST)
ctx |- fst(pair) => tFst


ctx |- pair => (tFst, tSnd)
--------------------------- (SND)
ctx |- snd(pair) => tSnd
```
