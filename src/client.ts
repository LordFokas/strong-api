import {
    type PathsWith,
    type Params,
    type Out,
    type In,
	type Endpoints,
} from './common.js';

class APICall<I, O, P>{
	#api:APIClient<any>;
	#url:string;
	#options:RequestInit;
	#params:P;
	#payload:I;

	constructor(api:APIClient<any>, url:string, options:RequestInit){
		this.#api = api;
		this.#url = url;
		this.#options = options;
	}

	params(params:P){
		this.#params = params;
		return this;
	}

	payload(payload:I){
		this.#payload = payload;
		return this;
	}

	async execute() : Promise<O>{
		// Build final URL with path parameters
		if(this.#params){
			let url = this.#url;
			for(const name in this.#params){
				if(name.startsWith("uuid_")){
					url = url.replace("@"+name.replace("uuid_", ""), this.#params[name] as any);
				}else{
					url = url.replace(":"+name, this.#params[name] as any);
				}
			}
			this.#url = url;
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
		return body ? JSON.parse(body, FXO.reviver) : undefined;
	}
}

export class APIError extends Error {
	readonly route: string;
	readonly status: number;
	readonly title: string;
	readonly body: string;
	readonly object: {};
	
	constructor(route: string, status: number, title: string, body: string){
		super("API Request Failed");
		this.route = route;
		this.status = status;
		this.title = title;
		this.body = body;
		try { this.object = JSON.parse(body); }
		catch {}
	}
}

export class APIClient<E extends Endpoints> {
	#headerSource: () => Record<string, string> = () => ({});

	GET    <P extends PathsWith<E, "GET">>    (path: P) { return this.call("GET",    path) }
    PUT    <P extends PathsWith<E, "PUT">>    (path: P) { return this.call("PUT",    path) }
    PATCH  <P extends PathsWith<E, "PATCH">>  (path: P) { return this.call("PATCH",  path) }
    DELETE <P extends PathsWith<E, "DELETE">> (path: P) { return this.call("DELETE", path) }

	call <M extends keyof E[P], P extends keyof E> (method: M, url: P) : APICall<In<E[P][M]>, Out<E[P][M]>, Params<E, P>>{
		return new APICall<In<E[P][M]>, Out<E[P][M]>, Params<E, P>>(this, (url as string), {
			method: (method as string),
			cache: "no-cache",
			credentials: "same-origin",
			headers: this.#headerSource()
		});
	}

	onFetchError(...$:any[]){
		console.error(...$);
	}

	setHeaderSource(source: () => Record<string, string>){
		this.#headerSource = source;
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

	except?(...fields : (keyof this)[]) : this {
		const clone = new (Object.getPrototypeOf(this).constructor)(this);
		for(const field of fields){
			delete clone[field];
		}
		return clone;
	}

	only?(...fields : (keyof this)[]) : this {
		const clone = new (Object.getPrototypeOf(this).constructor)({});
		for(const field of fields){
			clone[field] = this[field];
		}
		return clone;
	}
}