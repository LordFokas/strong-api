import {
    type PathsWith,
    type Params,
    type Out,
    type In,
	type Endpoints,
	type EK,
} from './common.js';

/**
 * Client that makes strongly type checked calls against a Endpoints-defined API.
 * @param E Endpoints definition
 * @param R Optional NS-UUID union resolution map
 */
export class APIClient<E extends Endpoints, R extends EK = {}> {
	#headerSource: (method:string, url:string) => Record<string, string> = () => ({});
	#optionsSource: (method:string, url:string) => Record<string, string> = () => ({
		cache: "no-cache",
		credentials: "same-origin",
	});
	#baseURL: string;

	/**
	 * @param baseUrl define a prefix for the API calls.
	 * Usually the API protocol, domain, and port.
	 * Further path segments may interfere with Endpoints
	 */
	constructor(baseUrl: string = "") {
		this.#baseURL = baseUrl;
	}

	/** Prepare a GET request. @returns an APICall object */
	GET    <P extends PathsWith<E, "GET">>    (path: P) { return this.call("GET",    path) }

	/** Prepare a PUT request. @returns an APICall object */
    PUT    <P extends PathsWith<E, "PUT">>    (path: P) { return this.call("PUT",    path) }

	/** Prepare a PATCH request. @returns an APICall object */
    PATCH  <P extends PathsWith<E, "PATCH">>  (path: P) { return this.call("PATCH",  path) }

	/** Prepare a DELETE request. @returns an APICall object */
    DELETE <P extends PathsWith<E, "DELETE">> (path: P) { return this.call("DELETE", path) }

	private call <M extends keyof E[P], P extends keyof E> (method: M, url: P) : APICall<In<E[P][M]>, Out<E[P][M]>, Params<E, P, R>>{
		return new APICall<In<E[P][M]>, Out<E[P][M]>, Params<E, P, R>>(this, this.#baseURL + (url as string), {
			...this.#optionsSource(method as any, url as any),
			method: (method as string),
			headers: this.#headerSource(method as any, url as any)
		});
	}

	onFetchError(...$:any[]){
		console.error(...$);
	}

	/** Set a source method called on every API call that returns headers to add to the request */
	setHeaderSource(source: (method:string, url:string) => Record<string, string>){
		this.#headerSource = source;
	}

	/** Set a source method called on every API call that returns a fetch options map to attach to the fetch call */
	setOptionsSource(source: (method:string, url:string) => Record<string, string>) {
		this.#optionsSource = source;
	}
}

type Value = string | number | boolean;

/**
 * API call configuration and execution object.
 * @param I the type of the input payload
 * @param O the type of the output payload
 * @param P structure of the required URL parameters
 */
class APICall<I, O, P>{
	#api:APIClient<any, any>;
	#url:string;
	#options:RequestInit;
	#params?:P;
	#query?:Record<string, Value>;
	#payload?:I;

	constructor(api:APIClient<any, any>, url:string, options:RequestInit){
		this.#api = api;
		this.#url = url;
		this.#options = options;
	}

	/**
	 * Define values to replace the URL params, must be called all at once
	 * @param params param map as parsed from the URL
	 * @returns this
	 */
	params(params:P){
		this.#params = params;
		return this;
	}

	/**
	 * Add query parameters. Can be called multiple times, additive
	 * @param query map of query parameters to add to the request
	 * @returns this
	 */
	query(query:Record<string, Value>){
		if(!this.#query) this.#query = {};
		Object.assign(this.#query, query);
		return this;
	}

	/**
	 * Add the request input payload, as defined per the respective `IO<I, any>` in Endpoints
	 * @param payload input payload object
	 * @returns this
	 */
	payload(payload:I){
		this.#payload = payload;
		return this;
	}

	/**
	 * Executes the request as configured per this object and returns the response, if any
	 * @returns the output payload, as defined per the respective `IO<any, O>` in Endpoints
	 */
	async execute() : Promise<O>{
		// Build final URL with path parameters and query strring
		if(this.#params){
			let url = this.#url;
			for(const key in this.#params){
				if(key.startsWith("uuid_")){
					const name = key.replace("uuid_", "");
					if(name.match(/^[A-Z]+$/)) {
						url = url.replace("@"+name, this.#params[key] as any); // @NS
					} else {
						url = url.replace(new RegExp(`@[A-Z]+\+${name}`), this.#params[key] as any); // @NS+name
					}
				}else{
					url = url.replace(":"+key, this.#params[key] as any); // :id
				}
			}
			this.#url = url;
		}
		if(this.#query) {
			this.#url += "?" + Object.entries(this.#query).map(e => e[0]+"="+e[1]).join("&");
		}

		// Serialize Payload
		if(this.#payload){
			(this.#options.headers as Record<string, string>)["Content-Type"] = "application/json";
			this.#options.body = JSON.stringify(this.#payload, FXO.serializer);
		}
		
		// Execute HTTP Endpoint Call
		let res, body;
		try{
			res = await fetch(this.#url, this.#options);
			body = await res.text();
		}catch(error){
			this.#api.onFetchError(error);
			throw new Error("Request Failed");
		}

		// Throw request error
		if(!res.ok){
			throw new APIError(this.#url, res.status, res.statusText, body);
		}
		
		// Return deserialized results
		return body ? JSON.parse(body, FXO.reviver) : undefined as any;
	}
}

export class APIError extends Error {
	readonly route: string;
	readonly status: number;
	readonly title: string;
	readonly body: string;
	readonly object?: {};
	
	constructor(route: string, status: number, title: string, body: string){
		super("API Request Failed");
		this.route = route;
		this.status = status;
		this.title = title;
		this.body = body;
		try { this.object = JSON.parse(body); }
		catch { }
	}
}

type ClassMap = { [key:string] : typeof FXO };
interface Type { ['@type']?:string; };
type Typed<F> = Type & F;

export interface FXO<T> extends Type {}
export class FXO<T> {
    static #classMap:ClassMap = {};
	static #reverse:Record<string, string>;
	
    static useClassMap(map:ClassMap){
        FXO.#classMap = map;
		FXO.#reverse = {};
		for(const [name, fxo] of Object.entries(map)) {
			FXO.#reverse[fxo.name] = name;
		}
    }

	static reviver(k:string, obj:Typed<any>){
		if(obj instanceof Object && obj['@type']){
			const model = FXO.#classMap[obj['@type']];
			return new model(obj);
		}else{
			return obj;
		}
	}

	static serializer(k:string, obj:FXO<any>){
		if(obj instanceof FXO){
			return new FXO(obj, true)
		}else{
			return obj;
		}
	}

	constructor(data:Partial<T>, assignType = false){
		Object.assign(this, data);
		if(assignType){
			const fxo:FXO<T> = data instanceof FXO ? data : this;
			this['@type'] = FXO.#reverse[fxo.constructor.name];
		}else{
			delete this['@type'];
		}
	}

	/** Create a clone with the specified fields deleted */
	except?(...fields : (keyof this)[]) : this {
		const clone = new (Object.getPrototypeOf(this).constructor)(this);
		for(const field of fields){
			delete clone[field];
		}
		return clone;
	}

	/** Create a clone with only the specified fields */
	only?(...fields : (keyof this)[]) : this {
		const clone = new (Object.getPrototypeOf(this).constructor)({});
		for(const field of fields){
			clone[field] = this[field];
		}
		return clone;
	}
}