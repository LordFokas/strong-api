export type Endpoints = Record<string, {
    "GET"?:    IO<any, any>
    "PUT"?:    IO<any, any>
    "PATCH"?:  IO<any, any>
    "DELETE"?: IO<any, any>
}>;

export type PathsWith<E extends Endpoints, T extends string> = {
    [P in keyof E]: T extends keyof E[P] ? P : never;
}[keyof E];

export type Mount<P extends string, E extends Endpoints> = {
    // @ts-ignore
    [K in keyof E as `${P}${K}`]: E[K];
}

export interface IO<I, O> { }
export type In<T extends IO<any, any>> = T extends IO<infer I, any> ? I : never;
export type Out<T extends IO<any, any>> = T extends IO<any, infer O> ? O : never;

export type UUID<K extends string> = `${K}::${string}`;
export type Value = string | number | boolean;

export type Params<E extends Endpoints, T extends keyof E, M extends KV>
= T extends `${infer A}/${infer B}`
? Collapse<Params<any, A, M> & Params<any, B, M>>
: ParseString<T>;

type ParseString<Query extends string, Params extends object = {}>
= Query extends `${string}:${infer ColonRule}`
    ? ColonRule extends `${infer Param}/${infer ContQuery}`
        ? ParseString<ContQuery, Params & {[P in Param] : Value}>
        : Params & {[P in ColonRule] : Value }
    : Params
;

type ParseUUID<Query extends string, M extends KV, Params extends object = {}>
= Query extends `${string}@${infer AtRule}`
    ? AtRule extends `${infer Param}/${infer ContQuery}`
        ? ParseUUID<ContQuery, Params & UUIDParam<Param, M>>
        : Params & UUIDParam<AtRule, M>
    : Params
;

type UUIDParam<P extends string, M extends KV>
= P extends `${infer N}+${infer K}`
    ? { [V in K as `uuid_${V}`]: UUID<Resolve<N, M>> }
    : { [V in P as `uuid_${V}`]: UUID<Resolve<P, M>> }
;

type Collapse<T> = T extends string | number | undefined | void ? T : { [P in keyof T]: T[P] };
type Resolve<N extends string, M extends KV> = N extends keyof M ? M[N] : N;
export type KV = Record<string, string>;







type MAP = {
	ID: "US"|"GR"
}
type url = "/asd/@ID+user/@US/:id";
type t = Params<any, url, KV>
type u = ParseUUID<url, MAP>