export function memoryDb(initial={}){
 const data=structuredClone(initial),queues=new Map(),writes=[];
 const get=path=>path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],data)??null;
 const set=(path,value)=>{const parts=path.split('/').filter(Boolean);let target=data;for(const key of parts.slice(0,-1))target=target[key]??={};if(value===null)delete target[parts.at(-1)];else target[parts.at(-1)]=structuredClone(value);writes.push(path);};
 const snap=value=>({val:()=>structuredClone(value),exists:()=>value!==null});
 const db={ref:(path='')=>({on(){},off(){},get:async()=>snap(get(path)),once:async()=>snap(get(path)),set:async value=>set(path,value),remove:async()=>set(path,null),update:async values=>{for(const[key,value]of Object.entries(values))set([path,key].filter(Boolean).join('/'),value);},transaction(fn){const result=(queues.get(path)||Promise.resolve()).then(()=>{const value=fn(structuredClone(get(path)));if(value===undefined)return{committed:false,snapshot:snap(get(path))};set(path,value);return{committed:true,snapshot:snap(value)};});queues.set(path,result.catch(()=>{}));return result;}})};
 return{db,data,writes,get,set};
}
