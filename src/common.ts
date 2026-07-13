/**
 * Defines the structure of a whole API by mapping each path to the IO types of each possible method
 * 
 * POST does not exist in the spec. Our lord and savior Sir Tim Berners-Lee gave you PUT and PATCH with HTTP v0.1, use them!
 */
export type Endpoints = Record<string, {
    "GET"?:    IO<any, any>
    "PUT"?:    IO<any, any>
    "PATCH"?:  IO<any, any>
    "DELETE"?: IO<any, any>
}>;

/** Defines an input and output type, to be mapped to a path of an Endpoints structure */
export interface IO<I, O> { }

/** Resolves to type `I` from the given `IO<I, any>` */
export type In<T extends IO<any, any>> = T extends IO<infer I, any> ? I : never;

/** Resolves to type `O` from the given `IO<any, O>` */
export type Out<T extends IO<any, any>> = T extends IO<any, infer O> ? O : never;

/**
 * Resolves the list of available paths in the API given an HTTP method
 * @param E Endpoints-type API structure definition
 * @param M HTTP Method
 */
export type PathsWith<E extends Endpoints, M extends string> = {
    [P in keyof E]: M extends keyof E[P] ? P : never;
}[keyof E];

/**
 * Mounts an `Endpoints` type structure onto a URL prefix
 * @param P URL prefix
 * @param E Endpoints-type API structure definition
 */
export type Mount<P extends string, E extends Endpoints> = {
    // @ts-ignore
    [K in keyof E as `${P}${K}`]: E[K];
}

/** Entity Keys -- NS-UUID param type resolution map */
export type EK = Record<string, string>;

/** Namespaced UUID (NS-UUID) */
export type UUID<K extends string> = `${K}::${string}`;

/** NS-UUID resolver. Provides EK[NS] if found, defaulting to NS otherwise */
type Resolve<N extends string, R extends EK> = N extends keyof R ? R[N] : N;

/** Collapses joined types into a single type */
type Collapse<T> = T extends string | number | undefined | void ? T : { [P in keyof T]: T[P] };

/** Recursive resolver that produces params type map for a given URL if any, or never otherwise */
export type Params<E extends Endpoints, T extends keyof E, R extends EK>
= T extends `${string}@${string}`|`${string}:${string}`
? Collapse<ParseUUID<T, R> & ParseString<T>>
: never;

/** Recursive resolver that produces a map of string params for a given url (`:id` format) */
type ParseString<Query extends string, Params extends object = {}>
= Query extends `${string}:${infer ColonRule}`
    ? ColonRule extends `${infer Param}/${infer ContQuery}`
        ? ParseString<ContQuery, Params & {[P in Param] : string}>
        : Params & {[P in ColonRule] : string }
    : Params
;

/** Recursive resolver that produces a map of NS-UUID params for a givel url (`@NS` and `@NS+name` formats) */
type ParseUUID<Query extends string, R extends EK, Params extends object = {}>
= Query extends `${string}@${infer AtRule}`
    ? AtRule extends `${infer Param}/${infer ContQuery}`
        ? ParseUUID<ContQuery, R, Params & UUIDParam<Param, R>>
        : Params & UUIDParam<AtRule, R>
    : Params
;

/** Resolver that determines a param name for a NS-UUID param, depending if it is named with `@NS+name` or not */
type UUIDParam<P extends string, R extends EK>
= P extends `${infer N}+${infer K}`
    ? { [V in K as `uuid_${V}`]: UUID<Resolve<N, R>> }
    : { [V in P as `uuid_${V}`]: UUID<Resolve<P, R>> }
;