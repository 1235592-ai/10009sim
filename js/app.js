window.App = {
    isGenerating: false,
    isPanelOpen: false,

    hardResetApp: function() {
        if(!confirm("최신 버전으로 앱을 강제 새로고침 하시겠습니까?\n(작성하신 시나리오와 설정 데이터는 안전하게 유지됩니다!)")) return;
        if ('serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(function(registrations) { for(let registration of registrations) { registration.unregister(); } }); }
        if ('caches' in window) { caches.keys().then(function(names) { for (let name of names) caches.delete(name); }).then(() => { window.location.reload(true); }); } 
        else { window.location.reload(true); }
    },

    init: async function() {
        await Store.init();
        
        const bgEl = document.getElementById('set-lobby-bg'); if(bgEl) bgEl.value = Store.state.lobbyBgUrl || '';
        const apiEl = document.getElementById('set-api-key'); if(apiEl) apiEl.value = Store.state.apiKey || '';
        const modEl = document.getElementById('set-model-name'); if(modEl) modEl.value = Store.state.modelName || 'gemini-3.1-flash-lite-preview';
        const modSel = document.getElementById('model-preset-sel'); if(modSel) { const opts = Array.from(modSel.options).map(o => o.value); modSel.value = opts.includes(Store.state.modelName) ? Store.state.modelName : ''; }

        history.replaceState({ page: 'lobby' }, "");
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('lobby-container').style.display = 'block'; 
        document.body.style.backgroundImage = Store.state.lobbyBgUrl ? `url('${Store.state.lobbyBgUrl}')` : 'none';

        window.addEventListener('beforeunload', () => { Store.forceSave(); });
        
        window.addEventListener('popstate', (e) => {
            const pop = document.getElementById('dice-settings-popover');
            if (UI.activeModal) { const closingModal = UI.activeModal; UI.activeModal = null; document.getElementById(closingModal).style.display = 'none'; if(!document.querySelector('.panel.open')) { document.getElementById('overlay').classList.remove('active'); } return; }
            if (this.isPanelOpen) { UI.syncPanelsBeforeClose(); this.isPanelOpen = false; document.querySelectorAll('.panel').forEach(p => p.classList.remove('open')); document.getElementById('overlay').classList.remove('active'); return; } 
            if (pop && pop.classList.contains('open')) { UI.internalClosePopover(); return; } 
            if (Store.state.activeRoomId) { if(this.isGenerating) { history.pushState({ page: 'room' }, ""); return; } UI.syncPanelsBeforeClose(); Store.state.activeRoomId = null; document.getElementById('game-container').style.display = 'none'; document.getElementById('lobby-container').style.display = 'block'; document.body.style.backgroundImage = Store.state.lobbyBgUrl ? `url('${Store.state.lobbyBgUrl}')` : 'none'; UI.renderScenarioList(); return; } 
            if (confirm("앱을 종료하시겠습니까?")) { history.back(); } else { history.pushState({ page: 'lobby' }, ""); }
        });
        
        document.addEventListener('click', (e) => {
            const pop = document.getElementById('dice-settings-popover'); const btn = document.getElementById('btn-action-expand');
            if (pop && pop.classList.contains('open')) { if (!pop.contains(e.target) && !btn.contains(e.target)) { if(history.state && history.state.popover) { history.back(); } else { UI.internalClosePopover(); } } }
        });

        const worldPanel = document.getElementById('world-panel');
        if(worldPanel) {
            worldPanel.addEventListener('focusin', (e) => {
                if(e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
                    let type = 'unknown'; let typeKor = ''; let titleEl = null; let descEl = null; let secretEl = null;

                    if(e.target.id === 'w-k-input') { type = 'keywords'; } 
                    else if(e.target.id === 'w-n' || e.target.id === 'w-d') {
                        type = 'basic'; typeKor = '기본 설정';
                        titleEl = document.getElementById('w-n'); descEl = document.getElementById('w-d');
                    } else {
                        const itemCard = e.target.closest('.item-card, .folder-box, .card-faction');
                        if(itemCard) {
                            titleEl = itemCard.querySelector('input[type="text"]');
                            if(itemCard.classList.contains('card-faction')) { 
                                type = 'faction'; typeKor = '세력'; 
                                descEl = itemCard.querySelector('textarea[id^="f-d-"]');
                                secretEl = itemCard.querySelector('textarea[id^="f-s-"]');
                            }
                            else {
                                descEl = itemCard.querySelector('textarea');
                                if(e.target.id.includes('lf-')) { type = 'loreFolder'; typeKor = '지식(대분류)'; }
                                else if(e.target.id.includes('l-')) { type = 'lore'; typeKor = '지식(상세)'; }
                                else if(e.target.id.includes('reg-')) { type = 'region'; typeKor = '지역(대분류)'; }
                                else if(e.target.id.includes('loc-')) { type = 'location'; typeKor = '장소(상세)'; }
                            }
                        }
                    }
                    if(type !== 'unknown') {
                        UI.lastFocusedWorldInput = { type, typeKor, titleEl, descEl, secretEl };
                        const mBtn = document.getElementById('magic-btn');
                        if(mBtn) { mBtn.disabled = false; mBtn.style.opacity = '1'; mBtn.style.boxShadow = '0 0 10px rgba(99, 102, 241, 0.6)'; }
                    }
                }
            });
        }

        const charPanel = document.getElementById('char-panel');
        if(charPanel) {
            charPanel.addEventListener('focusin', (e) => {
                const el = e.target;
                if(el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                    if(el.id === 'char-filter-sel') return;
                    const charCard = el.closest('.card-char');
                    if(!charCard) return;

                    const charId = charCard.id.replace('det-c-', '');
                    const cBtn = document.getElementById('char-magic-btn');
                    let type = null;

                    if (el.id.startsWith('c-n-')) {
                        if(cBtn) { cBtn.disabled = true; cBtn.style.opacity = '0.3'; cBtn.style.boxShadow = 'none'; }
                        return;
                    } else if (el.id.startsWith('c-d-')) { type = 'desc'; } 
                    else if (el.id.startsWith('c-s-')) { type = 'secret'; } 
                    else if (el.closest('.stat-row')) { type = 'stats'; } 
                    else if (el.closest('.rep-row')) { type = 'reputation'; } 
                    else { return; }

                    UI.lastFocusedCharInput = { type, charId, el };
                    if(cBtn) { cBtn.disabled = false; cBtn.style.opacity = '1'; cBtn.style.boxShadow = '0 0 10px rgba(99, 102, 241, 0.6)'; }
                }
            });
        }

        document.getElementById('lobby-container').classList.remove('hidden');
        UI.renderScenarioList(); UI.renderWorldTemplateList(); UI.renderSafetyUI();
    },

    handleKeywordInput: function(e) {
        const input = e.target;
        let val = input.value;
        if (val.includes(' ') || val.includes(',')) {
            const parts = val.split(/[\s,]+/);
            const w = Store.getTargetWorld();
            if(!w.keywords) w.keywords = [];
            
            let added = false;
            let fullLimit = false;

            parts.forEach(p => {
                let k = p.replace(/#/g, '').trim();
                if(k && !w.keywords.includes(k)) {
                    if(w.keywords.length < 10) { w.keywords.push(k); added = true; } 
                    else { fullLimit = true; }
                }
            });

            if (added) { Store.forceSave(); UI.renderKeywords(); }
            if (fullLimit) { UI.showToast("키워드는 최대 10개까지입니다."); }
            input.value = '';
        }
    },

    runWorldSketch: async function() {
        if(!Store.state.apiKey) return alert("API 키를 설정해주세요.");
        const w = Store.getTargetWorld();
        if(!w.keywords || w.keywords.length === 0) return alert("먼저 상단에 키워드를 1개 이상 입력해주세요!");

        const hasContent = w.name || w.prompt || w.factions.length > 0 || w.lores.length > 0 || w.locations.length > 0;
        if(hasContent) {
            if(!confirm("⚠️ 경고: 기존 데이터가 모두 삭제됩니다.\n정말 덮어쓰고 다시 스케치하시겠습니까?")) return;
        }

        UI.showAILoader("✨ 세계관 뼈대 설계 중");
        try {
            const data = await API.generateWorldSketch(w.keywords);
            if(!data) throw new Error("데이터 파싱에 실패했습니다.");
            
            w.name = data.name || (w.keywords.join(', ') + ' 세계관');
            w.prompt = data.prompt || '';
            w.factions = []; w.loreFolders = []; w.lores = []; w.regions = []; w.locations = [];

            if(data.factions) data.factions.forEach(f => w.factions.push({ id:'f_'+Date.now()+Math.random().toString(36).substr(2), name: f.name, desc: f.desc, secret: f.secret || '' }));
            if(data.lores && data.lores.length > 0) {
                const lfId = 'lf_'+Date.now();
                w.loreFolders.push({ id: lfId, name: '기초 지식', desc: '세계관 필수 상식' });
                data.lores.forEach(l => w.lores.push({ id:'l_'+Date.now()+Math.random().toString(36).substr(2), folderId: lfId, keyword: l.name, desc: l.desc, triggerLocId: '' }));
            }
            if(data.locations && data.locations.length > 0) {
                const regId = 'reg_'+Date.now();
                w.regions.push({ id: regId, name: '주요 지역', desc: '중심 무대' });
                data.locations.forEach(loc => w.locations.push({ id:'loc_'+Date.now()+Math.random().toString(36).substr(2), regionId: regId, name: loc.name, desc: loc.desc }));
            }

            Store.forceSave(); UI.renderWorld(); UI.showToast("스케치가 완료되었습니다!");
        } catch(e) { alert("스케치 실패: " + e.message); } 
        finally { UI.hideAILoader(); }
    },

    runMagicGenerator: async function() {
        if(!Store.state.apiKey) return alert("API 키를 설정해주세요.");
        const w = Store.getTargetWorld();
        if(!w.keywords || w.keywords.length === 0) return alert("먼저 상단에 키워드를 1개 이상 입력해주세요!");
        
        const target = UI.lastFocusedWorldInput;
        if(!target) return;

        if (target.type === 'keywords') {
            if(w.keywords.length >= 10) return alert("키워드가 이미 10개 꽉 찼습니다!");
            UI.showAILoader("✨ 추천 키워드 발굴 중");
            try {
                const res = await API.generateMoreKeywords(w.keywords);
                res.split(',').forEach(k => {
                    let clean = k.replace(/[\s#]/g, '').trim();
                    if(clean && !w.keywords.includes(clean) && w.keywords.length < 10) w.keywords.push(clean);
                });
                Store.forceSave(); UI.renderKeywords(); UI.showToast("키워드가 추가되었습니다!");
            } catch(e) { alert("생성 실패: " + e.message); }
            finally { UI.hideAILoader(); }
            return;
        }

        const title = target.titleEl ? target.titleEl.value.trim() : '';
        const desc = target.descEl ? target.descEl.value.trim() : '';
        const secret = target.secretEl ? target.secretEl.value.trim() : '';
        let mode = 'full';
        
        if (title && !desc && !secret) mode = 'desc_only';
        else if (desc || secret) {
            const isOverwrite = confirm("기존 내용이 있습니다.\n\n[확인]: 내용을 완전히 덮어쓰기\n[취소]: 문맥을 읽고 뒤에 덧붙이기 (추가)");
            mode = isOverwrite ? 'overwrite' : 'append';
        }

        UI.showAILoader(`✨ ${target.typeKor} 연성 중`);
        try {
            const dataObj = { title, desc, secret, hasSecretField: !!target.secretEl };
            const result = await API.generateDetail(target.typeKor, w, dataObj, mode);
            
            if (!result) throw new Error("데이터 구조 파싱 실패");

            if (mode === 'full') {
                if(target.titleEl && result.title) target.titleEl.value = result.title;
                if(target.descEl && result.desc) target.descEl.value = result.desc;
                if(target.secretEl && result.secret) target.secretEl.value = result.secret;
            } else {
                if (target.secretEl) {
                    if(result.desc) target.descEl.value = result.desc;
                    if(result.secret) target.secretEl.value = result.secret;
                } else {
                    if(target.descEl) target.descEl.value = result;
                }
            }
            
            if(target.descEl) UI.autoResize(target.descEl);
            if(target.secretEl) UI.autoResize(target.secretEl);
            
            Store.saveWorld(); UI.showToast("마법 연성이 완료되었습니다!");
        } catch(e) { alert("생성 실패: " + e.message); } 
        finally { UI.hideAILoader(); }
    },

    runNewCharGen: async function() {
        if(!Store.state.apiKey) return alert("API 키를 설정해주세요.");
        const w = Store.getTargetWorld();
        if(!w.keywords || w.keywords.length === 0) return alert("먼저 세계관 탭에서 키워드를 1개 이상 입력해주세요!");

        UI.showAILoader("✨ 세계관 맞춤 인물 창조 중");
        try {
            const data = await API.generateNewCharacter(w);
            if(!data || !data.keyword) throw new Error("캐릭터 생성에 실패했습니다.");

            const newChar = {
                id: 'c_' + Date.now(),
                keyword: data.keyword,
                desc: data.desc || '',
                secret: data.secret || '',
                stats: data.stats || [{n:'체력', v:50, active:true}],
                reputation: data.reputation || [],
                factionIds: [],
                triggerLocId: '',
                isHidden: false
            };

            w.characters.unshift(newChar);
            Store.forceSave();
            UI.renderCharacters();
            UI.showToast(`[${data.keyword}] 캐릭터가 생성되었습니다!`);
        } catch(e) { alert("생성 실패: " + e.message); } 
        finally { UI.hideAILoader(); }
    },

    runCharMagic: async function() {
        if(!Store.state.apiKey) return alert("API 키를 설정해주세요.");
        const w = Store.getTargetWorld();
        if(!w.keywords || w.keywords.length === 0) return alert("먼저 세계관 탭에서 키워드를 1개 이상 입력해주세요!");

        const target = UI.lastFocusedCharInput;
        if(!target) return;
        const c = w.characters.find(x => x.id === target.charId);
        if(!c) return;

        let mode = 'full';
        if (target.type === 'desc' || target.type === 'secret') {
            const val = target.el.value.trim();
            if (val) {
                const isOverwrite = confirm("기존 내용이 있습니다.\n\n[확인]: 내용을 완전히 덮어쓰기\n[취소]: 문맥을 읽고 뒤에 덧붙이기 (추가)");
                mode = isOverwrite ? 'overwrite' : 'append';
            }
            UI.showAILoader(`✨ 인물 ${target.type === 'desc' ? '상세설정' : '비밀'} 연성 중`);
        } else if (target.type === 'stats' || target.type === 'reputation') {
            UI.showAILoader(`✨ 맞춤 ${target.type === 'stats' ? '스탯' : '성향'} 스캔 중`);
            mode = 'add_array';
        }

        try {
            const res = await API.generateCharDetail(target.type, w, c, target.el.value, mode);
            if (!res) throw new Error("생성된 데이터가 없습니다.");

            if (target.type === 'desc') { 
                c.desc = res; target.el.value = res; UI.autoResize(target.el); 
            }
            else if (target.type === 'secret') { 
                c.secret = res; target.el.value = res; UI.autoResize(target.el); 
            }
            else if (target.type === 'stats') {
                if(!c.stats) c.stats = [];
                c.stats.push({ n: res.n || '신규스탯', v: res.v || 50, active: true });
                Store.forceSave(); UI.renderCharacters();
            } 
            else if (target.type === 'reputation') {
                if(!c.reputation) c.reputation = [];
                c.reputation.push({ id: 'rep_'+Date.now(), leftName: res.leftName || 'L', rightName: res.rightName || 'R', value: res.value || 0 });
                Store.forceSave(); UI.renderCharacters();
            }

            Store.saveCharacters();
            UI.showToast("연성이 완료되었습니다!");
        } catch(e) { alert("연성 실패: " + e.message); } 
        finally { UI.hideAILoader(); }
    },

    handleInputKey: function(e) {
        if(e.key === 'Enter' && !e.shiftKey) {
            if(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) { return; } 
            else { e.preventDefault(); if(!this.isGenerating) this.handleAction(); }
        }
    },

    enterRoom: function(id) { Store.state.activeRoomId = id; const r = Store.getActiveRoom(); r.lastUpdated = Date.now(); document.getElementById('lobby-container').style.display = 'none'; document.getElementById('game-container').style.display = 'flex'; history.pushState({ page: 'room' }, ""); this.loadActiveRoom(); Store.forceSave(); },
    exitToLobby: function() { if(this.isGenerating) return; history.back(); },
    editWorldTemplate: function(id) { Store.state.activeRoomId = null; Store.state.activeWorldId = id; UI.togglePanel('world-panel'); },

    loadActiveRoom: function(preserveScroll = false) {
        const r = Store.getActiveRoom(); if(!r) return; const w = r.worldInstance;
        const myChar = w.characters.find(c => c.id === r.myCharId); document.getElementById('header-user-name').innerText = myChar ? myChar.keyword : '무명';
        const actNpcs = r.activeCharIds.map(cid => w.characters.find(c=>c.id===cid)).filter(c=>c&&c.id!=='sys'); document.getElementById('header-npc-names').innerText = actNpcs.length > 0 ? actNpcs.map(c=>c.keyword).join(', ') : 'NPC 없음';
        let locName = "자유 이동 (미분류)"; if(r.currentLocIdx >= 0 && w.locations[r.currentLocIdx]) { const l = w.locations[r.currentLocIdx]; const reg = w.regions.find(rg => rg.id === l.regionId); locName = reg ? `${reg.name} - ${l.name}` : l.name; }
        document.getElementById('header-loc-name').innerText = `🧭 위치: ` + locName; document.body.style.backgroundImage = w.bgUrl ? `url('${w.bgUrl}')` : 'none'; 
        document.getElementById('room-memory-input').value = r.memory || ''; document.getElementById('global-status-input').value = r.globalStatus || '';
        Dice.refreshDiceUI(); UI.updateActionBtn(); 
        
        const container = document.getElementById('chat-container');
        const st = container.scrollTop; container.innerHTML = ''; 
        r.history.forEach((m, idx) => UI.appendMessageDOM(m, idx)); 
        if (preserveScroll) container.scrollTop = st; else UI.scrollToBottom(true);
    },

    handleAction: async function() {
        if(!Store.state.apiKey) return alert("설정 탭에서 API Key를 먼저 입력해주세요!");
        if(this.isGenerating) return; const el = document.getElementById('msg-input'); let text = el.value.trim(); 
        const diceStr = Dice.getDiceResultStr(); if(!text && !diceStr) text = "(계속)"; else text = diceStr + text;
        const r = Store.getActiveRoom(); r.history.push({ role:'user', variants:[text], currentVariant:0 }); r.lastUpdated = Date.now();
        UI.appendMessageDOM(r.history[r.history.length-1], r.history.length-1); el.value = ''; el.style.height = '45px'; UI.updateActionBtn(); Store.forceSave(); UI.scrollToBottom(true);
        this.runAI();
    },

    runAI: async function(isRegen=false, idx=null) {
        if(this.isGenerating) return; this.isGenerating = true; document.getElementById('action-btn').disabled = true;
        const r = Store.getActiveRoom(); const tIdx = isRegen ? idx : r.history.length;
        if(!isRegen) r.history.push({ role:'ai', variants:[""], currentVariant:0, charIds:[...r.activeCharIds] });
        else { if(r.history[tIdx].variants.length >= 5) { r.history[tIdx].variants.shift(); r.history[tIdx].currentVariant = r.history[tIdx].variants.length; } else r.history[tIdx].currentVariant = r.history[tIdx].variants.length; r.history[tIdx].variants.push(""); r.history[tIdx].charIds = [...r.activeCharIds]; this.loadActiveRoom(true); }
        
        const msgObj = r.history[tIdx]; let msgDiv = document.querySelector(`.message.ai[data-idx="${tIdx}"]`); if(!msgDiv) msgDiv = UI.appendMessageDOM(msgObj, tIdx);
        const textEl = msgDiv.querySelector('.msg-text'); const controlsEl = msgDiv.querySelector('.msg-controls'); if(controlsEl) controlsEl.remove();
        textEl.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>'; UI.scrollToBottom(true);

        const scan = r.history.slice(-5).map(m => m.variants[m.currentVariant]).join(" ");
        let contents = r.history.slice(Math.max(0, tIdx - 15), tIdx).filter(m => m.variants[m.currentVariant].trim() !== "").map(m => ({ role: m.role==='ai'?'model':'user', parts:[{text: m.variants[m.currentVariant]}] }));
        if(contents.length === 0) contents = [{role:'user', parts:[{text:'(시작해.)'}]}];
        const sysPrompt = API.buildPrompt(r, scan);

        let fullText = "";
        try { await API.streamGemini(contents, sysPrompt, (chunk) => { fullText += chunk; msgObj.variants[msgObj.currentVariant] = fullText; textEl.innerHTML = UI.formatMsg(fullText, 'ai'); }); } 
        catch(e) { if(!fullText.trim()) { msgObj.variants[msgObj.currentVariant] = "[오류] " + e.message; textEl.innerHTML = UI.formatMsg(msgObj.variants[msgObj.currentVariant], 'ai'); } } 
        finally { msgDiv.appendChild(UI.createCtrls(tIdx)); if(r.history.length > 0 && r.history.length % 20 === 0) this.triggerAutoSummary(); this.isGenerating = false; document.getElementById('action-btn').disabled = false; UI.updateActionBtn(); Store.forceSave(); UI.scrollToBottom(true); }
    }
};
