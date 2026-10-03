import {simulate} from './simulation.js';

self.onmessage=({data:{graph,settings}})=>{
 try{self.postMessage({sim:simulate(graph,settings)});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:'Simulation failed'});}
};
