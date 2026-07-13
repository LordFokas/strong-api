import type express from 'express';
import {
    type PathsWith,
    type Params,
    type Out,
    type In,
	type Endpoints,
	type IO,
	type KV
} from './common.js';

type Request = express.Request;
type HTTPD = express.IRouter;
type Method = "get"|"put"|"patch"|"delete";

export type Wrapper<D> = (promiser:() => Promise<D|void>) => void;
export type Transformer<T> = { fromObject: (obj:object) => T };

export class APIBuilder<E extends Endpoints, D, M extends KV = {}> {
	private httpd:HTTPD;
	private wrap:Wrapper<D>;

	constructor(httpd:HTTPD, wrapper:Wrapper<D>){
		this.httpd = httpd;
		this.wrap = wrapper;
	}

	GET<P extends PathsWith<E, "GET">>
	(url:P, handler:(params:Params<E, P, M>) => Promise<Out<E[P]["GET"]>>){
		return this.#PARAMS("GET", url, handler);
	}
    
	PUT<P extends PathsWith<E, "PUT">, I = In<E[P]["PUT"]>>
	(url:P, handler:(payload:I, params:Params<E, P, M>) => Promise<Out<E[P]["PUT"]>>, transformer:Transformer<I>){
		return this.#PAYLOAD("PUT", url, transformer, handler);
	}
    
	PATCH<P extends PathsWith<E, "PATCH">, I = In<E[P]["PATCH"]>>
	(url:P, handler:(payload:I, params:Params<E, P, M>) => Promise<Out<E[P]["PATCH"]>>, transformer:Transformer<I>){
		return this.#PAYLOAD("PATCH", url, transformer, handler);
	}

	DELETE<P extends PathsWith<E, "DELETE">>
	(url:P, handler:(params:Params<E, P, M>) => Promise<Out<E[P]["DELETE"]>>){
		return this.#PARAMS("DELETE", url, handler);
	}

	#PARAMS<M extends keyof E[P], P extends keyof E, R extends KV>
	(method:M, url:P, handler:(input:Params<E, P, R>) => Promise<Out<E[P][M]>>){
		this.httpd[(method as string).toLowerCase() as Method]((url as string).replace("@", ":uuid_"),
			(req:Request & { params:Params<E, P, R> }) => this.wrap(
				() => handler(req.params) as Promise<D|void>
			)
		)
	}
    
	#PAYLOAD< M extends keyof E[P], P extends keyof E, R extends KV, I = In<E[P][M]>>
	(method:M, url:P, transformer:Transformer<I>, handler:(input:I, params:Params<E, P, R>) => Promise<Out<E[P][M]>>){
		this.httpd[(method as string).toLowerCase() as Method](url as string,
			(req:Request) => this.wrap(
				() => handler(
					transformer.fromObject(req.body),
					req.params as Params<E, P, R>
				) as Promise<D|void>
			)
		)
	}
}


type MAP = {
	ID: "US"|"GR"
}
type TEST = {
	"/param": { PUT: IO<object, object> }
	"/param/@ID+user/@US": { PUT: IO<object, object> }
}
const api = new APIBuilder<TEST, any, MAP>(null, $ => $);

api.PUT("/param", async (obj, params) => { return obj; }, null);
api.PUT("/param/@ID+user/@US", async (obj) => obj, null);