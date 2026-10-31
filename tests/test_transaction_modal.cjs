// Dependency-free component harness except esbuild (pass its installed path).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esbuild = require(process.argv[2] || 'esbuild');
const source = fs.readFileSync('src/domains/finance/components/TransactionModal.jsx', 'utf8');
const compiled = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
let states, cursor, effects, runEffects, updates, alerts;
const react = {
  createElement: (type, props, ...children) => ({ type, props: {...props, children} }),
  useState: initial => { const i=cursor++; if (!(i in states)) states[i]=initial; return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]; },
  useMemo: fn => fn(),
  useEffect: fn => { if (runEffects) effects.push(fn); },
};
const config={ accounts:['Rappi Visa *3323','Rappi Visa *3716'], currencies:['COP'], categories:[] };
const moduleObject={exports:{}};
vm.runInNewContext(compiled, {
  module:moduleObject, exports:moduleObject.exports,
  require: name => name==='react'?react:name.includes('FinanceContext')?{
    useFinance:()=>({appConfig:config,updateTransaction:async (...args)=>updates.push(args)})
  }:{},
  alert:message=>alerts.push(message), console, Date,
});
const Modal=moduleObject.exports.default;
function render(tx){cursor=0;return Modal({isOpen:true,onClose:()=>{},editingTransaction:tx});}
function find(node,type){if(!node)return null;if(Array.isArray(node)){for(const c of node){const r=find(c,type);if(r)return r;}}else if(typeof node==='object'){if(node.type===type)return node;return find(node.props?.children,type);}return null;}
async function test(){
  states=[];effects=[];updates=[];alerts=[];runEffects=true;
  const tx={id:'synthetic',card:'',status:'pending',amount:30250,cardResolution:{status:'needs_review',reason:'unknown_suffix',observedLast4:['3716']}};
  render(tx);effects.forEach(f=>f());runEffects=false;
  let tree=render(tx);
  assert.equal(states[2].card,'','opening unresolved import must not default first account');
  await find(tree,'form').props.onSubmit({preventDefault(){}});
  assert.equal(updates.length,0,'blank card cannot save or become reviewed');
  assert.equal(alerts.length,1);
  states[2]={...states[2],card:'not-in-catalog'};
  tree=render(tx);await find(tree,'form').props.onSubmit({preventDefault(){}});
  assert.equal(updates.length,0,'non-catalog card cannot save');
  states[2]={...states[2],card:'Rappi Visa *3716'};
  tree=render(tx);await find(tree,'form').props.onSubmit({preventDefault(){}});
  assert.equal(updates.length,1);
  assert.equal(updates[0][1].card,'Rappi Visa *3716');
  assert.equal(updates[0][1].status,'reviewed');
  assert.equal(updates[0][1].cardResolution.reason,'manual_selection');
  assert.equal(updates[0][1].cardResolution.observedLast4[0],'3716');
  console.log('PASS: unresolved stays blank; invalid saves blocked; explicit selection resolves review metadata');
}
test().catch(e=>{console.error(e);process.exitCode=1;});
