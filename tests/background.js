/* Exercise settings → production background → actual request builder → session cache. */
(async () => {
  const report = document.getElementById('report');
  const passed = [];
  function check(value, label) { if (!value) throw new Error(label); passed.push(label); }
  const message = { type:'zh:summarize',subject:'Fixture',text:'meaningful '.repeat(201) };
  const sender = {id:'fixture',tab:{id:1},url:'https://mail.superhuman.com/inbox/thread/fixture'};
  const send = (request=message, origin=sender) => new Promise(resolve => fixtureHandler(request,origin,resolve));
  try {
    const popup = {id:'fixture',url:'chrome-extension://fixture/src/popup.html'};
    const config = await send({type:'zh:config'}, popup);
    check(config.ok && config.configured && !JSON.stringify(config).includes(fixtureKey), 'The popup can check configuration without receiving credentials');
    check(!(await send({type:'zh:set-key',key:'sk-'+'x'.repeat(24)})).ok && fixtureKey==='sk-fixture-placeholder', 'An email content script cannot overwrite the API key');
    check(!(await send({type:'zh:config'})).ok, 'API configuration is restricted to the extension popup');
    check(!(await send(message,{...sender,url:'https://example.com/'})).ok && !(await send(message,{...sender,id:'another-extension'})).ok && fixtureAPICalls.length===0, 'Other sites and extension identities cannot request summaries');
    check(!(await send({...message,text:'x'.repeat(120001)})).ok && fixtureAPICalls.length===0, 'Oversized input is rejected before a network request');
    fixtureKey='';
    check(!(await send()).ok && fixtureAPICalls.length===0, 'A missing key fails locally without a network request');
    const savedKey = 'sk-'+'x'.repeat(24);
    const saved = await send({type:'zh:set-key',key:savedKey},popup);
    check(saved.ok && saved.configured && fixtureKey===savedKey && fixtureKeyNotifications.length===1 &&
      JSON.stringify(fixtureKeyNotifications[0])==='{"type":"zh:key-updated"}', 'Saving a key succeeds and notifies Superhuman with no credential in the message');
    fixtureKey='sk-fixture-placeholder';
    const original = await send();
    const defaultCall = fixtureAPICalls[0];
    check(original.ok && defaultCall.model==='gpt-6.1-sol' && defaultCall.service_tier==='fast', 'Existing installs default to Sol 6.1 and Fast mode');
    check((await send()).summary.gist===original.summary.gist && fixtureAPICalls.length===1, 'Identical requests reuse the session cache');
    fixtureAPISettings.summaryFastMode=false;
    check((await send()).ok && fixtureAPICalls.at(-1).service_tier==='default', 'Fast mode off explicitly requests Standard processing');
    fixtureAPISettings.summaryModel='gpt-6-luna';
    check((await send()).ok && fixtureAPICalls.at(-1).model==='gpt-6-luna', 'The Luna choice reaches the API');
    fixtureAPISettings.summaryModel='gpt-6-astra';
    check((await send()).ok && fixtureAPICalls.at(-1).model==='gpt-6-astra', 'The Astra choice reaches the API');
    check(fixtureAPICalls.every(call=>!Object.hasOwn(call.text,'verbosity') && !Object.hasOwn(call,'verbosity')), 'Every API request omits verbosity entirely');
    const beforeRestore = fixtureAPICalls.length;
    Object.assign(fixtureAPISettings,{summaryModel:'gpt-6.1-sol',summaryFastMode:true});
    check((await send()).summary.gist===original.summary.gist && fixtureAPICalls.length===beforeRestore, 'Returning to previous settings reuses the matching session cache');
    const stale = await send({...message,preferencesKey:'old preferences'});
    check(!stale.ok && fixtureAPICalls.length===beforeRestore, 'Stale page preferences cannot be cached as another configuration');
    fixtureAPISettings.summaryWordThreshold=250;
    check(!(await send()).ok && fixtureAPICalls.length===beforeRestore, 'The saved word threshold is enforced before a cache lookup or API call');
    fixtureAPISettings.summaryWordThreshold=200;
    fixtureAPISettings.summarizeEmails=false;
    check(!(await send()).ok && fixtureAPICalls.length===beforeRestore, 'The main toggle prevents requests even when a summary is cached');
    check(fixtureAPICalls.every(call=>call.store===false && call.reasoning.effort==='low' && call.text.format.strict), 'Every configuration preserves no-store, low reasoning, and strict output structure');
    fixtureAPISettings.summarizeEmails=true;
    Object.keys(fixtureSession).forEach(key=>delete fixtureSession[key]);
    for(let i=0;i<59;i++) fixtureSession[`summary:seed-${i}`]={gist:'Seed',points:[],actions:[]};
    fixtureSession.unrelated='keep';
    const concurrent = await Promise.all([send({...message,subject:'Concurrent one'}),send({...message,subject:'Concurrent two'})]);
    check(concurrent.every(result=>result.ok) && Object.keys(fixtureSession).filter(key=>key.startsWith('summary:')).length===60 && fixtureSession.unrelated==='keep', 'Concurrent completions keep the cache at 60 summaries and preserve unrelated storage');
    fixtureResponse={ok:false,status:429};
    const limited=await send({...message,subject:'Rate limited'});
    check(!limited.ok && limited.error.includes('usage or rate limit'), 'API rate limits return a recoverable error');
    const beforeInvalid=Object.keys(fixtureSession).length;
    fixtureResponse={ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'{"gist":"bad","points":["wrong shape"],"actions":[]}'}]}]})};
    check(!(await send({...message,subject:'Invalid output'})).ok && Object.keys(fixtureSession).length===beforeInvalid, 'Malformed model output is rejected without entering the cache');
    fixtureResponse=null;
    report.textContent=`PASS: ${passed.length} API integration checks\n`+passed.map(label=>`✓ ${label}`).join('\n');report.dataset.result='pass';
  } catch(error) {report.textContent=`FAIL: ${error.message}\n`+passed.join('\n');report.dataset.result='fail';}
})();
