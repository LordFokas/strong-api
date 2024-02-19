export type Endpoints = {
	[k:string]: {
		"GET"?:    IO<any, any>
		"PUT"?:    IO<any, any>
		"PATCH"?:  IO<any, any>
		"DELETE"?: IO<any, any>
	}
}

export type PathsWith<E extends Endpoints, T extends string> = {
    [P in keyof E]: T extends keyof E[P] ? P : never;
}[keyof E];

export interface IO<I, O> { }
export type In<T extends IO<any, any>> = T extends IO<infer I, any> ? I : never;
export type Out<T extends IO<any, any>> = T extends IO<any, infer O> ? O : never;

export type Params<E extends Endpoints, T extends keyof E>
= T extends `${string}@${string}`|`${string}:${string}`
? Collapse<ParseUUID<T> & ParseString<T>>
: never;

type ParseString<Query extends string, Params extends object = {}>
= Query extends `${string}:${infer ColonRule}`
    ? ColonRule extends `${infer Param}/${infer ContQuery}`
        ? ParseString<ContQuery, Params & {[P in Param] : string}>
        : Params & {[P in ColonRule] : string}
    : Params
;

type ParseUUID<Query extends string, Params extends object = {}>
= Query extends `${string}@${infer AtRule}`
    ? AtRule extends `${infer Param}/${infer ContQuery}`
        ? ParseUUID<ContQuery, Params & {[P in Param as `uuid_${P}`] : `${Param}::${string}`}>
        : Params & {[P in AtRule as `uuid_${P}`] : `${AtRule}::${string}`}
    : Params
;

type Collapse<T> = T extends string | number | undefined | void ? T : { [P in keyof T]: T[P] };