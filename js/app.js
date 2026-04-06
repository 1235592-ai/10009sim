window.App = {
    isGenerating: false,
    isPanelOpen: false,

    hardResetApp: function() {
        if(!confirm("최신 버전으로 앱을 강제 새로고침 하시겠습니까?\n(작성하신 시나리오와 설정 데이터는 안전하게 유지됩니다!)")) return;
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) { registration.unregister(); }
            });
        }
        if ('caches' in window) {
            caches.keys().then(function(names) {
                for (let name of names) caches.delete(name);
            }).then(() => { window.location.reload(true); });
        } else {
            window.location.reload(true);
        }
    },

    init: async function() {
        await Store.init();
        window.addEventListener('beforeunload', () => { Store.forceSave(); });
        window.addEventListener('popstate', (e) => {
            if (this.isPanelOpen) {
                UI.syncPanelsBeforeClose();
                this.isPanelOpen = false; document.querySelectorAll('.panel').forEach(p => p.classList.remove('open')); document.getElementById('overlay').classList.remove('active'); document.querySelectorAll('.modal-base').forEach(m => m.style.display = 'none');
            } else { if (confirm("앱을 종료하시겠습니까?")) { history.back(); } else { history.pushState({ main: true }, ""); } }
        });
        document.getElementById('lobby-container').classList.remove('hidden');
        UI.renderScenarioList(); UI.renderWorldTemplateList(); UI.renderSafetyUI();
    },

    handleInputKey: function(e) {
        if(e.key === 'Enter' && !e.shiftKey) {
            if(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                return; // 모바일: 줄바꿈 허용
            } else {
                e.preventDefault(); // PC: 줄바꿈 방지 및 전송
                if(!this.isGenerating) this.handleAction();
            }
        }
    },

    enterRoom: function(id) { Store.state.activeRoomId = id; const r = Store.getActiveRoom(); r.lastUpdated = Date.now(); document.getElementById('lobby-container').classList.add('hidden'); this.loadActiveRoom(); Store.forceSave(); },
    exitToLobby: function() { if(this.isGenerating) return; UI.syncPanelsBeforeClose(); document.querySelectorAll('.panel').forEach(p => p.classList.remove('open')); document.getElementById('overlay').classList.remove('active'); Store.state.activeRoomId = null; document.getElementById('lobby-container').classList.remove('hidden'); UI.renderScenarioList(); },
    
    editWorldTemplate: function(id) { Store.state.activeRoomId = null; Store.state.activeWorldId = id; UI.togglePanel('world-panel'); },

    loadActiveRoom: function() {
        const r = Store.getActiveRoom(); if(!r) return; const w = r.worldInstance;
        const myChar = w.characters.find(c => c.id === r.myCharId); document.getElementById('header-user-name').innerText = myChar ? myChar.keyword : '무명';
        const actNpcs = r.activeCharIds.map(cid => w.characters.find(c=>c.id===cid)).filter(c=>c&&c.id!=='sys'); document.getElementById('header-npc-names').innerText = actNpcs.length > 0 ? actNpcs.map(c=>c.keyword).join(', ') : 'NPC 없음';
        let locName = "자유 이동 (미분류)"; if(r.currentLocIdx >= 0 && w.locations[r.currentLocIdx]) { const l = w.locations[r.currentLocIdx]; const reg = w.regions.find(rg => rg.id === l.regionId); locName = reg ? `${reg.name} - ${l.name}` : l.name; }
        document.getElementById('header-loc-name').innerText = `🧭 위치: ` + locName; document.body.style.backgroundImage = w.bgUrl ? `url('${w.bgUrl}')` : 'none'; 
        document.getElementById('room-memory-input').value = r.memory || ''; document.getElementById('global-status-input').value = r.globalStatus || '';
        Dice.refreshDiceUI(); UI.updateActionBtn(); document.getElementById('chat-container').innerHTML = ''; r.history.forEach((m, idx) => UI.appendMessageDOM(m, idx)); UI.scrollToBottom(true);
    },

    handleAction: async function() {
        if(!Store.state.apiKey) return alert("설정 탭에서 API Key를 먼저 입력해주세요!");
        if(this.isGenerating) return; const el = document.getElementById('msg-input'); let text = el.value.trim(); const diceStr = Dice.getDiceResultStr(); if(!text && !diceStr) text = "(계속)"; else text = diceStr + text;
        document.getElementById('dice-enable').checked = false; const r = Store.getActiveRoom(); r.history.push({ role:'user', variants:[text], currentVariant:0 }); r.lastUpdated = Date.now();
        UI.appendMessageDOM(r.history[r.history.length-1], r.history.length-1); el.value = ''; el.style.height = '45px'; UI.updateActionBtn(); Store.forceSave(); UI.scrollToBottom(true);
        this.runAI();
    },

    runAI: async function(isRegen=false, idx=null) {
        if(this.isGenerating) return; this.isGenerating = true; document.getElementById('action-btn').disabled = true;
        const r = Store.getActiveRoom(); const tIdx = isRegen ? idx : r.history.length;
        if(!isRegen) r.history.push({ role:'ai', variants:[""], currentVariant:0, charIds:[...r.activeCharIds] });
        else {
            if(r.history[tIdx].variants.length >= 5) { r.history[tIdx].variants.shift(); r.history[tIdx].currentVariant = r.history[tIdx].variants.length; } 
            else r.history[tIdx].currentVariant = r.history[tIdx].variants.length; 
            r.history[tIdx].variants.push(""); r.history[tIdx].charIds = [...r.activeCharIds]; this.loadActiveRoom();
        }
        
        const msgObj = r.history[tIdx]; let msgDiv = document.querySelector(`.message.ai[data-idx="${tIdx}"]`); if(!msgDiv) msgDiv = UI.appendMessageDOM(msgObj, tIdx);
        const textEl = msgDiv.querySelector('.msg-text'); const controlsEl = msgDiv.querySelector('.msg-controls'); if(controlsEl) controlsEl.remove();
        textEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>'; UI.scrollToBottom(true);

        const scan = r.history.slice(-5).map(m => m.variants[m.currentVariant]).join(" ");
        let contents = r.history.slice(Math.max(0, tIdx - 15), tIdx).filter(m => m.variants[m.currentVariant].trim() !== "").map(m => ({ role: m.role==='ai'?'model':'user', parts:[{text: m.variants[m.currentVariant]}] }));
        if(contents.length === 0) contents = [{role:'user', parts:[{text:'(시작해.)'}]}];
        const sysPrompt = API.buildPrompt(r, scan);

        let fullText = "";
        try {
            await API.streamGemini(contents, sysPrompt, (chunk) => { fullText += chunk; msgObj.variants[msgObj.currentVariant] = fullText; textEl.innerHTML = UI.formatMsg(fullText, 'ai'); });
        } catch(e) { if(!fullText.trim()) { msgObj.variants[msgObj.currentVariant] = "[오류] " + e.message; textEl.innerHTML = UI.formatMsg(msgObj.variants[msgObj.currentVariant], 'ai'); } } 
        finally { msgDiv.appendChild(UI.createCtrls(tIdx)); if(r.history.length > 0 && r.history.length % 20 === 0) this.triggerAutoSummary(); this.isGenerating = false; document.getElementById('action-btn').disabled = false; UI.updateActionBtn(); Store.forceSave(); UI.scrollToBottom(true); }
    },

    triggerAutoSummary: async function() {
        const r = Store.getActiveRoom(); const histText = r.history.slice(-20).map(m=>m.variants[m.currentVariant]).join("\n");
        try { const text = await API.callGemini([{role:'user', parts:[{text: `다음 대화를 3줄로 요약해:\n\n${histText}`}]}], r.worldInstance.prompt); let mem = r.memory || ""; mem += (mem ? "\n\n" : "") + "[자동 요약]\n" + text; const blocks = mem.split('[자동 요약]'); if(blocks.length > 4) mem = blocks[0] + '[자동 요약]' + blocks.slice(-3).join('[자동 요약]'); r.memory = mem; document.getElementById('room-memory-input').value = r.memory; Store.updateRoomState('memory', r.memory); UI.showToast("✨ 기억이 요약 저장되었습니다."); } catch(e) {}
    },

    processStatUpdate: async function(idx) {
        if(!Store.state.apiKey) return alert("API Key 필요!");
        const r = Store.getActiveRoom(); const w = r.worldInstance; const msg = r.history[idx].variants[r.history[idx].currentVariant];
        let statChanged = false; let repChanged = false;
        const tChars = w.characters.filter(c => r.activeCharIds.includes(c.id) || c.id === r.myCharId);
        const cStatStr = tChars.map(c => c.stats&&c.stats.length ? `${c.keyword}: ` + c.stats.map(s=>`${s.n}(${s.v})`).join(', ') : null).filter(x=>x).join('\n');
        if (cStatStr) {
            UI.showToast("📊 1/2: 스탯 분석 중...");
            try {
                const text = await API.callGemini([{role:'user',parts:[{text:`스탯 증감 추정 후 JSON 반환. [{"charName":"이름", "statName":"체력", "newValue":최종}]\n[현재]\n${cStatStr}\n[텍스트] ${msg}`}]}], null, {temp:0.1});
                API.parseAIJsonRaw(text).forEach(item => { let c = tChars.find(x => x.keyword === item.charName || x.keyword.includes(item.charName)); if(c) { const s = c.stats.find(x => x.n === item.statName); if(s && confirm(`[스탯 변동]\n${c.keyword}의 [${s.n}]을 ${s.v} -> ${item.newValue} 변경?`)) { s.v = item.newValue; statChanged = true; } } });
            } catch(e) {}
        }
        const cRepStr = tChars.map(c => c.reputation&&c.reputation.length ? `${c.keyword}: ` + c.reputation.map(rep => `${rep.id}(${rep.leftName||'L'}↔${rep.rightName||'R'}:현재${rep.value})`).join(', ') : null).filter(x=>x).join('\n');
        if(cRepStr) {
            UI.showToast("⚖️ 2/2: 평판 분석 중...");
            try {
                const text = await API.callGemini([{role:'user',parts:[{text:`평판 변동 추정 후 JSON 반환. [{"charName":"이름", "repId":"ID", "change":-1,0,1}]\n좌:-1, 우:1\n[현재]\n${cRepStr}\n[텍스트] ${msg}`}]}], null, {temp:0.1});
                API.parseAIJsonRaw(text).forEach(item => { let c = tChars.find(x => x.keyword === item.charName || x.keyword.includes(item.charName)); if(c) { const rep = c.reputation.find(x => x.id === item.repId); if(rep && item.change !== 0) { let newVal = Math.max(-5, Math.min(5, rep.value + item.change)); const dirStr = item.change > 0 ? `[${rep.rightName||'우측'}] 방향으로 +${item.change}` : `[${rep.leftName||'좌측'}] 방향으로 ${item.change}`; if(confirm(`[성향 변동]\n${c.keyword} 성향이 ${dirStr} 된 듯.\n${rep.value} -> ${newVal} 적용?`)) { rep.value = newVal; repChanged = true; } } } });
            } catch(e) {}
        }
        if(statChanged || repChanged) { Store.forceSave(); UI.renderCharacters(); Dice.refreshDiceUI(); UI.showToast("스탯/성향 갱신 완료!"); } else UI.showToast("적용할 변동 사항 없음");
    },

    rewindRoom: function(idx) { if(this.isGenerating) return; if(confirm("이후 대화를 지우고 여기서 다시 시작할까요?")) { Store.getActiveRoom().history = Store.getActiveRoom().history.slice(0, idx + 1); Store.forceSave(); this.loadActiveRoom(); } },
    branch: function(idx) { if(this.isGenerating) return; const r = Store.getActiveRoom(); const h = JSON.parse(JSON.stringify(r.history.slice(0,idx))).map(m=>({role:m.role, variants:[m.variants[m.currentVariant]], currentVariant:0, charIds:m.charIds})); const nr = { ...JSON.parse(JSON.stringify(r)), id:'r_'+Date.now(), name:'[분기] '+r.name, history:h, lastUpdated:Date.now() }; Store.state.rooms.unshift(nr); Store.state.activeRoomId = nr.id; Store.forceSave(); UI.renderScenarioList(); this.loadActiveRoom(); UI.showToast("새 분기(채팅방)로 이동했습니다."); this.runAI(); },

    extractTemplate: function(roomId) { 
        if(!confirm("이 시나리오의 현재 세계관(인물, 장소 등)을 새로운 템플릿으로 추출하시겠습니까?")) return;
        const r = Store.state.rooms.find(x => x.id === roomId); 
        if(!r) return;
        const wClone = JSON.parse(JSON.stringify(r.worldInstance));
        this.remapWorldIds(wClone);
        wClone.id = 'w_' + Date.now();
        wClone.name = wClone.name + " (추출본)";
        Store.state.worlds.unshift(wClone);
        Store.forceSave();
        UI.showToast("새 템플릿으로 추출되었습니다.");
    },

    updateRoomTag: function(id, val) { const t = Store.state.roomTags.find(x=>x.id===id); if(t && val.trim()) { t.name = val.trim(); Store.forceSave(); UI.renderScenarioList(); } },
    deleteRoomTag: function(id) { if(!confirm("영구 삭제하시겠습니까?")) return; Store.state.roomTags = Store.state.roomTags.filter(x=>x.id!==id); Store.state.rooms.forEach(r => { r.tagIds = r.tagIds.filter(tid=>tid!==id); }); Store.forceSave(); UI.renderScenarioList(); UI.renderTagManageList(); },
    addRoomTag: function(rId, selEl, e) { e.stopPropagation(); const tId = selEl.value; if(!tId) return; selEl.value = ''; const r = Store.state.rooms.find(x => x.id === rId); if(!r.tagIds.includes(tId)) { r.tagIds.push(tId); Store.forceSave(); UI.renderScenarioList(); } },
    removeRoomTag: function(rId, tId, e) { e.stopPropagation(); const r = Store.state.rooms.find(x => x.id === rId); r.tagIds = r.tagIds.filter(id => id !== tId); Store.forceSave(); UI.renderScenarioList(); },
    editRoomInfo: function(id) { document.getElementById('edit-room-id').value = id; document.getElementById('edit-room-name').value = Store.state.rooms.find(x => x.id === id).name; UI.openModal('edit-room-modal'); },
    saveRoomInfo: function() { const r = Store.state.rooms.find(x => x.id === document.getElementById('edit-room-id').value); if(r) { r.name = document.getElementById('edit-room-name').value.trim() || '시나리오'; Store.forceSave(); UI.renderScenarioList(); } UI.closeModal('edit-room-modal'); },
    cloneRoom: function(id) { const t = Store.state.rooms.find(r => r.id === id); if(confirm("복제하시겠습니까? (대화는 초기화됨)")) { const nr = JSON.parse(JSON.stringify(t)); nr.id = 'r_'+Date.now(); nr.name = t.name + " (새 회차)"; nr.history = []; nr.memory = ''; nr.networkArchive = ''; nr.lastUpdated = Date.now(); const idMap = this.remapWorldIds(nr.worldInstance); if(idMap[nr.myCharId]) nr.myCharId = idMap[nr.myCharId]; nr.activeCharIds = nr.activeCharIds.map(cid => idMap[cid] || cid); Store.state.rooms.unshift(nr); Store.forceSave(); UI.renderScenarioList(); UI.showToast("복제 완료"); } },
    
    // DB에서 완전히 삭제
    deleteRoom: function(id) { 
        if(confirm("삭제하시겠습니까?")) { 
            Store.state.rooms = Store.state.rooms.filter(x=>x.id!==id); 
            Store.removeRoomDB(id); 
            Store.forceSave(); 
            UI.renderScenarioList(); 
        } 
    },
    
    createNewRoom: function() { 
        const wId = document.getElementById('new-room-world-sel').value; 
        if(!wId) return alert("세계관을 먼저 선택하세요."); 
        const sourceWorld = Store.state.worlds.find(w => w.id === wId); 
        const worldClone = JSON.parse(JSON.stringify(sourceWorld)); 
        this.remapWorldIds(worldClone); 
        let myC = worldClone.characters.find(c => c.id !== 'sys' && !c.isHidden); 
        if(!myC) { myC = {id:'c_'+Date.now(), keyword:'플레이어', desc:'주인공.', secret:'', stats:[{n:'체력', v:50, active:true}], reputation:[], factionIds:[], triggerLocId:'', isHidden:false}; worldClone.characters.push(myC); } 
        Store.state.rooms.unshift({ id: 'r_'+Date.now(), name: document.getElementById('new-room-name').value.trim() || '새 시나리오', lastUpdated: Date.now(), worldInstance: worldClone, myCharId: myC.id, activeCharIds: ['sys'], history: [], memory: '', globalStatus: '', currentLocIdx: -1, networkArchive: '', tagIds: [] }); 
        Store.forceSave(); UI.renderScenarioList(); UI.closeModal('new-room-modal'); UI.showToast("생성 완료"); 
    },
    
    importChar: function(wId, cId) { const sW = Store.state.worlds.find(w=>w.id===wId); const sC = sW.characters.find(c=>c.id===cId); const dW = Store.getTargetWorld(); if(dW.characters.some(c=>c.keyword===sC.keyword)) return alert("같은 이름 존재"); dW.characters.push({ id:'c_'+Date.now(), keyword:sC.keyword, desc:sC.desc, secret:sC.secret, stats:JSON.parse(JSON.stringify(sC.stats)), reputation:JSON.parse(JSON.stringify(sC.reputation||[])), factionIds:[], triggerLocId:'', isHidden:false }); Store.forceSave(); UI.showToast(sC.keyword+" 불러오기 완료."); UI.renderCharacters(); },
    
    remapWorldIds: function(w) { const idMap = {}; const gen = (pfx) => pfx + '_' + Date.now() + Math.random().toString(36).substr(2,5); w.regions.forEach(x => { const o=x.id; x.id=gen('reg'); idMap[o]=x.id; }); w.locations.forEach(x => { const o=x.id; x.id=gen('loc'); idMap[o]=x.id; }); w.factions.forEach(x => { const o=x.id; x.id=gen('f'); idMap[o]=x.id; }); w.loreFolders.forEach(x => { const o=x.id; x.id=gen('lf'); idMap[o]=x.id; }); w.lores.forEach(x => { const o=x.id; x.id=gen('l'); idMap[o]=x.id; }); w.characters.forEach(x => { if(x.id !== 'sys') { const o=x.id; x.id=gen('c'); idMap[o]=x.id; } if(x.reputation) x.reputation.forEach(r => { r.id = gen('rep'); }); }); w.locations.forEach(x => { if(idMap[x.regionId]) x.regionId = idMap[x.regionId]; }); w.lores.forEach(x => { if(idMap[x.triggerLocId]) x.triggerLocId = idMap[x.triggerLocId]; if(idMap[x.folderId]) x.folderId = idMap[x.folderId]; }); w.characters.forEach(x => { if(idMap[x.triggerLocId]) x.triggerLocId = idMap[x.triggerLocId]; if(x.factionIds) x.factionIds = x.factionIds.map(fid => idMap[fid] || fid); }); return idMap; }
};

window.onload = async () => { await window.App.init(); };
