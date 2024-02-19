import {
    type PathsWith,
    type Params,
    type Out,
    type In
} from './common.js';

type CB<T> = (r:T) => void;

class APICall<I, O, P>{
	#api:API<any>;
	#url:string;
	#options:RequestInit;
	#then:CB<O>;  // http success
	#error:CB<any>; // http error
	#params:P;
	#payload:I;

	constructor(api:API<any>, url:string, options:RequestInit){
		this.#api = api;
		this.#url = url;
		this.#options = options;
	}
	
	error(cb:CB<any>){ this.#error = cb; return this; }
	then(cb:CB<O>){ this.#then = cb; return this; }

	params(params:P){
		this.#params = params;
		return this;
	}

	payload(payload:I){
		this.#payload = payload;
		return this;
	}

	execute(){
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

		if(this.#payload){
			(this.#options.headers as Record<string, string>)["Content-Type"] = "application/json";
			this.#options.body = JSON.stringify(this.#payload, FXO.serializer);
		}
		
		fetch(this.#url, this.#options)
		.then(async res => {
			if(res.headers.get('X-API-Maintenance') == 'true'){
                window.location.reload();
            }else{
                const json = await res.text();
                let object = undefined;
                if(json) object = JSON.parse(json, FXO.reviver);
                if(res.ok){
                    this.#then != undefined && this.#then(object as O);
                }else{
                    this.#error != undefined && this.#error(object);
                }
            }
		})
		.catch(this.#api.onFetchError);
	}
}

export class API<E> {
	#headerSource: () => Record<string, string> = () => ({});

    // @ts-ignore
	GET    <P extends PathsWith<E, "GET">>    (path: P) { return this.call("GET",    path) }
    // @ts-ignore
    PUT    <P extends PathsWith<E, "PUT">>    (path: P) { return this.call("PUT",    path) }
    // @ts-ignore
    PATCH  <P extends PathsWith<E, "PATCH">>  (path: P) { return this.call("PATCH",  path) }
    // @ts-ignore
    DELETE <P extends PathsWith<E, "DELETE">> (path: P) { return this.call("DELETE", path) }

	call <M extends keyof E[P], P extends keyof E> (method: M, url: P) : APICall<In<E[P][M]>, Out<E[P][M]>, Params<E, P>>{
        // @ts-ignore
		return new APICall<In<E[P][M]>, Out<E[P][M]>, Params<E, P>>(this, url, {
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

export class FXO<T> {
    static #classMap:ClassMap = {};
	['@type']?:string;

    static useClassMap(map:ClassMap){
        FXO.#classMap = map;
    }

	static reviver(k:string, obj:FXO<any>){
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

	constructor(data:FXO<T>, assignType = false){
		Object.assign(this, data);
		if(assignType && (data instanceof FXO)){
			this['@type'] = data.constructor.name;
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