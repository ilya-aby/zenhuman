(async () => {
  const report=document.getElementById('report');
  const passed=[];
  const check=(condition,label)=>{if(!condition)throw new Error(label);passed.push(label);};
  const until=async predicate=>{const end=performance.now()+5000;while(!predicate()){if(performance.now()>end)throw new Error('Timed out waiting for integration state');await new Promise(r=>setTimeout(r,30));}};
  const send=message=>chrome.runtime.sendMessage(message);
  const request=(subject,prefetch=false)=>({type:'zh:summarize',subject,text:'meaningful '.repeat(220),prefetch});
  try {
    await until(()=>fixtureCalls.length===3 && document.querySelector('.zh-summary-gist'));
    check(fixtureCalls[0].body.input.includes('current'), 'Current email starts before speculative work');
    check(fixtureCalls.slice(1).some(c=>c.body.input.includes('below')) && fixtureCalls.slice(1).some(c=>c.body.input.includes('above')), 'Prefetch finds one eligible cached neighbor each way, skipping short and missing bodies');
    check(fixtureCalls.every(c=>!c.body.input.includes('hidden preheader')&&!c.body.input.includes('sponsor pitch')&&!c.body.input.includes('quoted reply')), 'Detached cache extraction filters hidden text, ads and quoted replies');
    const started=performance.now();
    fixtureProps.messageId='below';fixtureProps.threadId='below';
    history.replaceState({},'', '/inbox/thread/below');
    document.querySelector('.ShadowBody')?.remove();
    fixtureBody.innerHTML='<div class="ShadowBody">'+fixtureHTML('below')+'</div>';
    await until(()=>document.querySelector('.zh-summary-gist')?.textContent.includes('below'));
    check(fixtureCalls.length===3 && performance.now()-started<400, 'Opening a prefetched message paints from the in-page cache promptly without another API call');
    fixtureMap.get('current').renders.current._raw.unquotedHtml=fixtureHTML('updated-current');
    fixtureProps.messageId='short';fixtureProps.threadId='short';
    history.replaceState({},'', '/inbox/thread/short');
    fixtureBody.innerHTML='<div class="ShadowBody"><p>Short email</p></div>';
    await until(()=>fixtureCalls.length===4);
    check(!document.querySelector('.zh-summary-card') && fixtureCalls.at(-1).body.input.includes('updated-current'), 'Reading a short email still prepares the next eligible long email');
    Object.assign(fixtureSettings,{summarizeEmails:false});
    fixtureListeners.forEach(fn=>fn({summarizeEmails:{newValue:false}},'sync'));
    check(!document.querySelector('.zh-summary-card'), 'Disabling summaries removes the card and stops speculation');

    fixtureSettings.summarizeEmails=true;fixtureHeld=true;
    const base=fixtureCalls.length;
    const first=send(request('held-prefetch',true));
    await until(()=>fixtureCalls.length===base+1);
    const waiting=send(request('queued-prefetch',true));
    const foreground=send(request('foreground'));
    await until(()=>fixtureCalls.length===base+2);
    check(fixtureCalls.at(-1).body.input.includes('foreground'), 'A speculative request leaves a slot available for the current email');
    const foreground2=send(request('foreground-two'));
    fixtureCalls[base+1].finish();await foreground;
    await until(()=>fixtureCalls.length===base+3);
    check(fixtureCalls.at(-1).body.input.includes('foreground-two'), 'Foreground work takes priority over queued prefetch');
    const duplicate=send(request('held-prefetch'));
    fixtureCalls[base].finish();await first;await duplicate;
    await until(()=>fixtureCalls.length===base+4);
    check(fixtureCalls.filter(c=>c.subject==='held-prefetch').length===1, 'Opening an in-flight prefetched email shares the existing API call');
    fixtureCalls[base+2].finish();await foreground2;
    fixtureCalls[base+3].finish();await waiting;

    const pending1=send(request('cancel-running',true));
    await until(()=>fixtureCalls.length===base+5);
    const pending2=send(request('cancel-queued',true));
    await new Promise(r=>setTimeout(r,60));
    fixtureSettings.summarizeEmails=false;
    fixtureListeners.forEach(fn=>fn({summarizeEmails:{newValue:false}},'sync'));
    check(!(await pending1).ok && !(await pending2).ok && fixtureCalls.length===base+5, 'Disabling cancels running speculation and prevents queued API calls');
    check(fixtureProps.threadId==='short', 'Cache reads and prefetch never navigate the conversation');
    report.textContent=`PASS: ${passed.length} prefetch integration checks\n`+passed.map(p=>'✓ '+p).join('\n');report.dataset.result='pass';
  } catch(error){report.textContent=`FAIL: ${error.message}\n`+passed.join('\n');report.dataset.result='fail';}
})();
