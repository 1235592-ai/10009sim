window.Store = {
    VERSION: 100,
    state: {
        apiKey: '', modelName: 'gemini-3.1-flash-lite-preview', lobbyBgUrl: '',
        safety: { violence: false, discrimination: false, sexual: false, abuse: false, selfharm: false, drugs: false, marysue: false, obsession: false, gore: false, romance: false },
        roomTags: [], worlds: [], rooms: [], activeRoomId: null, activeWorldId: null
    },
    saveTimeout: null,
    db: null,

    openDB: function() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('10009SIM_DB', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if(!db.objectStoreNames.contains('master')) db.createObjectStore('master', {keyPath: 'id'});
                if(!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', {keyPath: 'id'});
                if(!db.objectStoreNames.contains('rooms')) db.createObjectStore('rooms', {keyPath: 'id'});
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    dbGet: function(storeName, id) { return new Promise(resolve => { const req = this.db.transaction(storeName, 'readonly').objectStore(storeName).get(id); req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null); }); },
    dbGetAll: function(storeName) { return new Promise(resolve => { const req = this.db.transaction(storeName, 'readonly').objectStore(storeName).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => resolve([]); }); },
    dbPut: function(storeName, item) { return new Promise(resolve => { const req = this.db.transaction(storeName, 'readwrite').objectStore(storeName).put(item); req.onsuccess = () => resolve(); req.onerror = () => resolve(); }); },
    dbDelete: function(storeName, id) { return new Promise(resolve => { const req = this.db.transaction(storeName, 'readwrite').objectStore(storeName).delete(id); req.onsuccess = () => resolve(); req.onerror = () => resolve(); }); },

    init: async function() {
        try { this.db = await this.openDB(); } catch(e) { alert("저장소 초기화 실패. 브라우저 설정(시크릿 모드 등)을 확인하세요."); return; }
        
        const master = await this.dbGet('master', 'main');
        if (master) {
            this.state.apiKey = master.apiKey || ''; 
            this.state.modelName = master.modelName || 'gemini-3.1-flash-lite-preview';
            this.state.lobbyBgUrl = master.lobbyBgUrl || '';
            this.state.safety = Object.assign({ violence: false, discrimination: false, sexual: false, abuse: false, selfharm: false, drugs: false, marysue: false, obsession: false, gore: false, romance: false }, master.safety || {}); 
            this.state.roomTags = master.roomTags || [];
            this.state.worlds = await this.dbGetAll('worlds');
            this.state.rooms = await this.dbGetAll('rooms');
            this.state.rooms.forEach(r => { if(!r.tagIds) r.tagIds = []; });
        } else {
            const defaultSys = {id:'sys', keyword:'시스템', desc:'전지적 시스템', secret:'', stats:[], reputation:[], factionIds:[], triggerLocId:'', isHidden:true};
            const defaultWorld = { id: 'w_'+Date.now(), name: '기본 세계관', prompt: '현대 배경.', bgUrl: '', regions: [], locations: [], factions: [], loreFolders: [], lores: [], characters: [defaultSys] };
            this.state.worlds.push(defaultWorld);
            this.forceSave(); 
        }
    },

    forceSave: function() {
        if(this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            if(!this.db) return;
            const master = { id: 'main', apiKey: this.state.apiKey, modelName: this.state.modelName, safety: this.state.safety, roomTags: this.state.roomTags, lobbyBgUrl: this.state.lobbyBgUrl };
            try {
                const tx = this.db.transaction(['master', 'worlds', 'rooms'], 'readwrite');
                tx.objectStore('master').put(master);
                this.state.worlds.forEach(w => tx.objectStore('worlds').put(w));
                if (this.state.activeRoomId) {
                    const r = this.getActiveRoom();
                    if(r) tx.objectStore('rooms').put(r);
                } else {
                    this.state.rooms.forEach(r => tx.objectStore('rooms').put(r));
                }
            } catch(e) { console.error("DB Save Error", e); }
        }, 300);
    },
    
    saveSettings: function() { 
        this.state.apiKey = document.getElementById('set-api-key').value; 
        this.state.modelName = document.getElementById('set-model-name').value || 'gemini-3.1-flash-lite-preview'; 
        this.state.lobbyBgUrl = document.getElementById('set-lobby-bg').value.trim();
        this.forceSave(); 
        
        // 로비에 있을 경우 즉시 배경 업데이트
        if(!this.state.activeRoomId) {
            document.body.style.backgroundImage = this.state.lobbyBgUrl ? `url('${this.state.lobbyBgUrl}')` : 'none';
        }
        UI.showToast("설정이 저장되었습니다."); 
    },
    
    getActiveRoom: function() { return this.state.rooms.find(r => r.id === this.state.activeRoomId); },
    getTargetWorld: function() { if(this.state.activeRoomId) return this.getActiveRoom().worldInstance; return this.state.worlds.find(w => w.id === this.state.activeWorldId); },
    updateRoomState: function(key, val) { const r = this.getActiveRoom(); if(r) { r[key] = val; this.forceSave(); } },
    setLoc: function(idx) { const r = this.getActiveRoom(); if(!r) return; r.currentLocIdx = idx; this.forceSave(); App.loadActiveRoom(); UI.closeOverlay(); },
    saveRoomMemory: function() { const r = this.getActiveRoom(); if(!r) return; r.memory = document.getElementById('room-memory-input').value; r.globalStatus = document.getElementById('global-status-input').value; this.forceSave(); UI.showToast("상황/세계 상태가 저장되었습니다."); },
    saveNetwork: function() { const r = this.getActiveRoom(); if(!r) return; r.networkArchive = document.getElementById('network-edit-area').value; this.forceSave(); UI.editNetwork(false); UI.renderNetworkArchive(); },

    removeRoomDB: async function(id) { await this.dbDelete('rooms', id); },
    
    createNewWorldTemplate: function() { const newW = { id: 'w_'+Date.now(), name: '새 세계관', prompt: '', bgUrl: '', regions: [], locations: [], factions: [], loreFolders: [], lores: [], characters: [{id:'sys', keyword:'시스템', desc:'', secret:'', stats:[], reputation:[], factionIds:[], triggerLocId:'', isHidden:true}] }; this.state.worlds.unshift(newW); this.forceSave(); UI.renderWorldTemplateList(); UI.showToast("새 템플릿 생성됨"); App.editWorldTemplate(newW.id); },
    deleteWorldTemplate: function(id) { if(!confirm("이 템플릿을 영구 삭제하시겠습니까? (시나리오 데이터는 유지됨)")) return; this.state.worlds = this.state.worlds.filter(w => w.id !== id); this.dbDelete('worlds', id); this.forceSave(); UI.renderWorldTemplateList(); },
    
    syncWorldDOM: function() {
        const w = this.getTargetWorld(); if(!w) return;
        w.name = document.getElementById('w-n')?.value ?? w.name; 
        w.prompt = document.getElementById('w-d')?.value ?? w.prompt; 
        w.bgUrl = document.getElementById('w-url')?.value ?? w.bgUrl;
        
        w.factions.forEach(f => { f.name = document.getElementById(`f-n-${f.id}`)?.value ?? f.name; f.desc = document.getElementById(`f-d-${f.id}`)?.value ?? f.desc; f.secret = document.getElementById(`f-s-${f.id}`)?.value ?? f.secret; });
        w.loreFolders.forEach(lf => { lf.name = document.getElementById(`lf-n-${lf.id}`)?.value ?? lf.name; lf.desc = document.getElementById(`lf-d-${lf.id}`)?.value ?? lf.desc; });
        w.lores.forEach(l => { l.keyword = document.getElementById(`l-n-${l.id}`)?.value ?? l.keyword; l.desc = document.getElementById(`l-d-${l.id}`)?.value ?? l.desc; l.folderId = document.getElementById(`l-fld-${l.id}`)?.value ?? l.folderId; l.triggerLocId = document.getElementById(`l-trig-${l.id}`)?.value ?? l.triggerLocId; });
        w.regions.forEach(reg => { reg.name = document.getElementById(`reg-n-${reg.id}`)?.value ?? reg.name; reg.desc = document.getElementById(`reg-d-${reg.id}`)?.value ?? reg.desc; });
        w.locations.forEach(loc => { loc.name = document.getElementById(`loc-n-${loc.id}`)?.value ?? loc.name; loc.desc = document.getElementById(`loc-d-${loc.id}`)?.value ?? loc.desc; loc.regionId = document.getElementById(`loc-r-${loc.id}`)?.value ?? loc.regionId; });
    },
    saveWorld: function() { this.syncWorldDOM(); this.forceSave(); UI.renderWorld(); UI.showToast("세계관이 저장되었습니다."); if(this.state.activeRoomId) App.loadActiveRoom(); else UI.renderWorldTemplateList(); },
    addFaction: function() { const w = this.getTargetWorld(); this.syncWorldDOM(); w.factions.push({ id:'f_'+Date.now(), name:'', desc:'', secret:'' }); this.forceSave(); UI.renderWorld(); },
    addLoreFolder: function() { const w = this.getTargetWorld(); this.syncWorldDOM(); w.loreFolders.push({ id:'lf_'+Date.now(), name:'', desc:'' }); this.forceSave(); UI.renderWorld(); },
    addLore: function(fId) { const w = this.getTargetWorld(); this.syncWorldDOM(); w.lores.push({ id:'l_'+Date.now(), folderId: fId, keyword:'', desc:'', triggerLocId:'' }); this.forceSave(); UI.renderWorld(); },
    addRegion: function() { const w = this.getTargetWorld(); this.syncWorldDOM(); w.regions.push({ id:'reg_'+Date.now(), name:'', desc:'' }); this.forceSave(); UI.renderWorld(); },
    addLocation: function(rId) { const w = this.getTargetWorld(); this.syncWorldDOM(); w.locations.push({ id:'loc_'+Date.now(), regionId: rId, name:'', desc:'' }); this.forceSave(); UI.renderWorld(); },
    
    delWorldItem: function(type, id, e) {
        if(e) e.stopPropagation(); if(!confirm("삭제하시겠습니까?")) return;
        const w = this.getTargetWorld(); this.syncWorldDOM();
        if(type==='f') w.factions = w.factions.filter(x=>x.id!==id);
        if(type==='lf') { w.loreFolders = w.loreFolders.filter(x=>x.id!==id); w.lores.forEach(l=>{ if(l.folderId===id) l.folderId=''; }); }
        if(type==='l') w.lores = w.lores.filter(x=>x.id!==id);
        if(type==='reg') { w.regions = w.regions.filter(x=>x.id!==id); w.locations.forEach(loc=>{ if(loc.regionId===id) loc.regionId=''; }); }
        if(type==='loc') {
            const idx = w.locations.findIndex(x=>x.id===id);
            if(idx !== -1) {
                w.locations.splice(idx, 1);
                if(this.state.activeRoomId) {
                    const r = this.getActiveRoom();
                    if(r.currentLocIdx === idx) r.currentLocIdx = -1;
                    else if(r.currentLocIdx > idx) r.currentLocIdx--;
                }
            }
        }
        this.forceSave(); UI.renderWorld();
    },

    syncCharDOM: function() {
        const w = this.getTargetWorld(); if(!w) return;
        w.characters.forEach(c => {
            c.keyword = document.getElementById(`c-n-${c.id}`)?.value ?? c.keyword;
            c.desc = document.getElementById(`c-d-${c.id}`)?.value ?? c.desc;
            c.secret = document.getElementById(`c-s-${c.id}`)?.value ?? c.secret;
            if (c.id !== 'sys') { 
                const fEl = document.getElementById(`c-f-hid-${c.id}`); if(fEl) c.factionIds = fEl.value ? fEl.value.split(',') : []; 
                c.triggerLocId = document.getElementById(`c-trig-${c.id}`)?.value ?? c.triggerLocId; 
            }
        });
    },
    saveCharacters: function() { this.syncCharDOM(); this.forceSave(); UI.renderCharacters(); UI.showToast("인물 설정이 저장되었습니다."); if(this.state.activeRoomId) App.loadActiveRoom(); },
    addCharacter: function() { const w = this.getTargetWorld(); this.syncCharDOM(); w.characters.push({ id:'c_'+Date.now(), keyword:'', desc:'', secret:'', stats:[], reputation:[], factionIds:[], triggerLocId:'', isHidden:false }); this.forceSave(); UI.renderCharacters(); },
    delChar: function(id) { if(!confirm("인물을 삭제하시겠습니까?")) return; const w = this.getTargetWorld(); this.syncCharDOM(); w.characters = w.characters.filter(c => c.id !== id); const r = this.getActiveRoom(); if(r) { r.activeCharIds = r.activeCharIds.filter(cid => cid !== id); if(r.myCharId === id) r.myCharId = null; } this.forceSave(); UI.renderCharacters(); },
    toggleActiveNpc: function(id) { const r = this.getActiveRoom(); if(!r) return; this.syncCharDOM(); if(r.activeCharIds.includes(id)) r.activeCharIds = r.activeCharIds.filter(x => x !== id); else r.activeCharIds.push(id); this.forceSave(); UI.renderCharacters(); App.loadActiveRoom(); },
    setMyChar: function(id) { const r = this.getActiveRoom(); if(!r) return; this.syncCharDOM(); r.myCharId = id; r.activeCharIds = r.activeCharIds.filter(x => x !== id); this.forceSave(); UI.renderCharacters(); App.loadActiveRoom(); },
    toggleHidden: function(id) { const w = this.getTargetWorld(); const c = w.characters.find(x => x.id === id); if(c) { this.syncCharDOM(); c.isHidden = !c.isHidden; this.forceSave(); UI.renderCharacters(); } },
    addFacTag: function(cId, selEl) { const fId = selEl.value; if(!fId) return; selEl.value = ''; const hid = document.getElementById(`c-f-hid-${cId}`); let arr = hid.value ? hid.value.split(',') : []; if(!arr.includes(fId)) { arr.push(fId); hid.value = arr.join(','); UI.renderFacTags(cId); } },
    removeFacTag: function(cId, fId) { const hid = document.getElementById(`c-f-hid-${cId}`); let arr = hid.value ? hid.value.split(',') : []; arr = arr.filter(x => x !== fId); hid.value = arr.join(','); UI.renderFacTags(cId); },
    addStat: function(cId) { const w = this.getTargetWorld(); const c = w.characters.find(x => x.id === cId); if(c) { this.syncCharDOM(); if(!c.stats) c.stats = []; c.stats.push({ n:'', v:50, active:true }); this.forceSave(); UI.renderCharacters(); } },
    delStat: function(cId, sIdx) { const w = this.getTargetWorld(); const c = w.characters.find(x => x.id === cId); if(c && confirm("스탯을 삭제하시겠습니까?")) { this.syncCharDOM(); c.stats.splice(sIdx, 1); this.forceSave(); UI.renderCharacters(); } },
    upStat: function(cId, sIdx, key, val) { const w = this.getTargetWorld(); const c = w.characters.find(x => x.id === cId); if(c && c.stats[sIdx]) { c.stats[sIdx][key] = (key==='v' ? Number(val) : val); this.forceSave(); } },
    addRep: function(cId) { const w = this.getTargetWorld(); const c = w.characters.find(x => x.id === cId); if(c) { this.syncCharDOM(); if(!c.reputation) c.reputation = []; c.reputation.push({ id:'rep_'+Date.now(), leftName:'', rightName:'', value:0 }); this.forceSave(); UI.renderCharacters(); } },
    delRep: function(cId, rIdx) { const w = this.getTargetWorld(); const c = w.characters.find(x => x.id === cId); if(c && confirm("이 성향 축을 삭제하시겠습니까?")) { this.syncCharDOM(); c.reputation.splice(rIdx, 1); this.forceSave(); UI.renderCharacters(); } },
    upRep: function(cId, rIdx, key, val) { const w = this.getTargetWorld(); const c = w.characters.find(x => x.id === cId); if(c && c.reputation[rIdx]) { c.reputation[rIdx][key] = (key==='value' ? Number(val) : val); this.forceSave(); } },

    exportData: function() { 
        if(!confirm("모든 설정과 시나리오 데이터를 백업 파일(JSON)로 다운로드하시겠습니까?")) return;
        const exp = { apiKey: this.state.apiKey, modelName: this.state.modelName, safety: this.state.safety, roomTags: this.state.roomTags, lobbyBgUrl: this.state.lobbyBgUrl, worlds: this.state.worlds, rooms: this.state.rooms }; 
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(exp)], {type:'application/json'})); a.download = `10009SIM_Backup_${Date.now()}.json`; a.click(); 
    },
    exportChatToTxt: function() { 
        if(!confirm("현재 시나리오의 대화 로그를 텍스트 파일(TXT)로 다운로드하시겠습니까?")) return;
        const r = this.getActiveRoom(); if(!r) return; const w = r.worldInstance; let txt = `${r.name} - 로그\\n\\n`; 
        r.history.forEach(m => { const speaker = m.role === 'user' ? (w.characters.find(c=>c.id===r.myCharId)?.keyword || 'USER') : (m.charIds || ['sys']).map(id => w.characters.find(c=>c.id===id)?.keyword).filter(x=>x).join(', ') || '시뮬레이터'; txt += `[${speaker}]\\n${m.variants[m.currentVariant]}\\n\\n`; }); 
        const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'})); a.download=`${r.name}.txt`; a.click(); 
    },
    importData: function(e) { 
        const r = new FileReader(); 
        r.onload = async (ev) => { 
            try { 
                const st = JSON.parse(ev.target.result); 
                if(this.db) { this.db.close(); this.db = null; } 
                await new Promise(res => { const req = indexedDB.deleteDatabase('10009SIM_DB'); req.onsuccess = res; req.onerror = res; });
                
                this.db = await this.openDB();
                const tx = this.db.transaction(['master', 'worlds', 'rooms'], 'readwrite');
                tx.objectStore('master').put({id:'main', apiKey:st.apiKey||'', modelName:st.modelName||'gemini-3.1-flash-lite-preview', safety:st.safety||this.state.safety, roomTags:st.roomTags||[], lobbyBgUrl:st.lobbyBgUrl||''});
                if(st.worlds) st.worlds.forEach(w => tx.objectStore('worlds').put(w)); 
                if(st.rooms) st.rooms.forEach(rm => tx.objectStore('rooms').put(rm));
                tx.oncomplete = () => { alert("복원 완료! 앱을 재시작합니다."); window.location.reload(); };
            } catch(err) { alert("잘못된 파일입니다."); } 
        }; 
        if(e.target.files[0]) r.readAsText(e.target.files[0]); 
    }
};
