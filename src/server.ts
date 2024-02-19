import type express from 'express';
import {
    type PathsWith,
    type Params,
    type Out,
    type In,
	Endpoints
} from './common.js';

type Request = express.Request;
type HTTPD = express.IRouter;
type Method = "get"|"put"|"patch"|"delete";

export type Wrapper<D> = (promiser:() => Promise<D|void>) => void;
export type Transformer<T> = { fromObject: (obj:object) => T };

export class APIBuilder<E extends Endpoints, D> {
	private httpd:HTTPD;
	private wrap:Wrapper<D>;

	constructor(httpd:HTTPD, wrapper:Wrapper<D>){
		this.httpd = httpd;
		this.wrap = wrapper;
	}

	GET<P extends PathsWith<E, "GET">>
	(url:P, handler:(params:Params<E, P>) => Promise<Out<E[P]["GET"]>>){
		return this.#PARAMS("GET", url, handler);
	}

    
	PUT<P extends PathsWith<E, "PUT">, I = In<E[P]["PUT"]>>
	(url:P, handler:(payload:I) => Promise<Out<E[P]["PUT"]>>, transformer:Transformer<I>){
		return this.#PAYLOAD("PUT", url, transformer, handler);
	}

    
	PATCH<P extends PathsWith<E, "PATCH">, I = In<E[P]["PATCH"]>>
	(url:P, handler:(payload:I) => Promise<Out<E[P]["PATCH"]>>, transformer:Transformer<I>){
		return this.#PAYLOAD("PATCH", url, transformer, handler);
	}

	DELETE<P extends PathsWith<E, "DELETE">>
	(url:P, handler:(params:Params<E, P>) => Promise<Out<E[P]["DELETE"]>>){
		return this.#PARAMS("DELETE", url, handler);
	}

	#PARAMS<M extends keyof E[P], P extends keyof E>
	(method:M, url:P, handler:(input:Params<E, P>) => Promise<Out<E[P][M]>>){
		this.httpd[(method as string).toLowerCase() as Method]((url as string).replace("@", ":uuid_"),
			(req:Request & { params:Params<E, P> }) => this.wrap(
				() => handler(req.params) as Promise<D|void>
			)
		)
	}

    
	#PAYLOAD< M extends keyof E[P], P extends keyof E, I = In<E[P][M]>>
	(method:M, url:P, transformer:Transformer<I>, handler:(input:I) => Promise<Out<E[P][M]>>){
		this.httpd[(method as string).toLowerCase() as Method](url as string,
			(req:Request) => this.wrap(
				() => handler(
					this.wrapPayloadValidation(() => transformer.fromObject(req.body))
				) as Promise<D|void>
			)
		)
	}

	wrapPayloadValidation<T>(fn: () => T) : T {
		try{
			const payload = fn();
			return payload;
		}catch( error ){
			if(error instanceof Error){
				throw new PayloadError(error.message);
			}else{
				throw error;
			}
		}
	}
}

export class PayloadError extends Error {}