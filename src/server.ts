import type express from 'express';
import {
    type PathsWith,
    type Params,
    type Out,
    type In,
	type Endpoints,
	type EK
} from './common.js';

type Request = express.Request;
type HTTPD = express.IRouter;
type Method = "get"|"put"|"patch"|"delete";

/** Function that wraps the execution of an async function */
export type Wrapper<D> = (promiser:() => Promise<D|void>) => void;

/** Object that is able to hydrate JSON input into the native class instances */
export type Transformer<T> = { fromObject: (obj:object) => T };

/**
 * Wrapper utility that constructs endpoint handling infrastructure automatically,
 * enforcing the rules as defined by the Endpoints definition
 * @param E Endpoints definition for this API
 * @param D Endpoint return type, the wrapper must pass it onto the response
 * @param M Optional NS-UUID union resolution map
*/
export class APIBuilder<E extends Endpoints, D, M extends EK = {}> {
	private httpd:HTTPD;
	private wrap:Wrapper<D>;

	/**
	 * @param httpd Express App or Router object
	 * @param wrapper Wrapper that handles security, errors, and passing the output payload onto the response
	 */
	constructor(httpd:HTTPD, wrapper:Wrapper<D>){
		this.httpd = httpd;
		this.wrap = wrapper;
	}

	/** Handle a GET request. Restricted to paths with this method as per the given Endpoints. */
	GET<P extends PathsWith<E, "GET">>
	(url:P, handler:(params:Params<E, P, M>) => Promise<Out<E[P]["GET"]>>){
		return this.#PARAMS("GET", url, handler);
	}
    
	/** Handle a PUT request. Restricted to paths with this method as per the given Endpoints. */
	PUT<P extends PathsWith<E, "PUT">, I = In<E[P]["PUT"]>>
	(url:P, handler:(payload:I, params:Params<E, P, M>) => Promise<Out<E[P]["PUT"]>>, transformer:Transformer<I>){
		return this.#PAYLOAD("PUT", url, transformer, handler);
	}
    
	/** Handle a PATCH request. Restricted to paths with this method as per the given Endpoints. */
	PATCH<P extends PathsWith<E, "PATCH">, I = In<E[P]["PATCH"]>>
	(url:P, handler:(payload:I, params:Params<E, P, M>) => Promise<Out<E[P]["PATCH"]>>, transformer:Transformer<I>){
		return this.#PAYLOAD("PATCH", url, transformer, handler);
	}

	/** Handle a DELETE request. Restricted to paths with this method as per the given Endpoints. */
	DELETE<P extends PathsWith<E, "DELETE">>
	(url:P, handler:(params:Params<E, P, M>) => Promise<Out<E[P]["DELETE"]>>){
		return this.#PARAMS("DELETE", url, handler);
	}

	/** Handles methods with no input payload (GET, DELETE) */
	#PARAMS<M extends keyof E[P], P extends keyof E, R extends EK>
	(method:M, url:P, handler:(input:Params<E, P, R>) => Promise<Out<E[P][M]>>){
		this.httpd[(method as string).toLowerCase() as Method]((url as string).replaceAll(/@[A-Z]+\+/, ":uuid_").replaceAll(/@/, ":uuid_"),
			(req:Request & { params:Params<E, P, R> }) => this.wrap(
				() => handler(req.params) as Promise<D|void>
			)
		)
	}
    
	/** Handles methods with input payload (PUT, PATCH) */
	#PAYLOAD< M extends keyof E[P], P extends keyof E, R extends EK, I = In<E[P][M]>>
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