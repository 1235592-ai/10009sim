window.UI = {
    activeModal: null,

    esc: function(s) { return s === undefined || s === null ? '' : s.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); },
    autoResize: function(el) { 
        if (!el) return; 
        el.style.height = '1px'; 
        
        const maxH = 300; 
        
        if (el.scrollHeight >= maxH) {
            el.style.height = maxH + 'px';
            el.style.overflowY = 'auto';
        } else {
            el.style.height = el.scrollHeight + 'px';
            el.style.overflowY = 'hidden';
        }
        
        if (el.id === 'msg-input') this.scrollToBottom(true); 
    },

    scrollToBottom: function(instant = false) { const c = document.getElementById('chat-container'); if(instant) c.scrollTop = c.scrollHeight; else c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' }); },
    showToast: function(msg) { const t = document.getElementById('toast-noti'); t.innerText=msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); },
    
    switchTab: function(id, e) { document.querySelectorAll('.lobby-tab').forEach(t=>t.classList.remove('active')); document.querySelectorAll('.lobby-content').forEach(c=>c.classList.remove('active')); e.target.classList.add('active'); document.getElementById(id).classList.add('active'); if(id === 'tab-scenarios') this.renderScenarioList(); if(id === 'tab-worlds') this.renderWorldTemplateList(); },
    
    // 🔥 모달 열림 시 브라우저 히스토리 스택 추가
    openModal: function(id) { 
        this.activeModal = id;
        document.getElementById(id).style.display = 'block'; 
        document.getElementById('overlay').classList.add('active'); 
        history.pushState({ modal: id }, ""); // 백버튼 방어선 구축
    },
    closeModal: function(id) { 
        this.activeModal = null;
        document.getElementById(id).style.display = 'none'; 
        if(!document.querySelector('.panel.open')) { document.getElementById('overlay').classList.remove('active'); }
    },
    closeAllModals: function() { 
        this.activeModal = null;
        document.querySelectorAll('.modal-base').forEach(m => m.style.display = 'none'); 
        if(!document.querySelector('.panel.open')) { document.getElementById('overlay').classList.remove('active'); }
    },
    closeOverlay: function() {
        if(this.activeModal) { 
            history.back(); // 오버레이 클릭 시에도 자연스러운 popstate 트리거 유도
        } 
        else if (App.isPanelOpen) { history.back(); }
    },

    toggleActionPopover: function() {
        const pop = document.getElementById('dice-settings-popover');
        if(pop.classList.contains('open')) {
            history.back(); 
        } else {
            history.pushState({ popover: true }, ""); 
            this.internalOpenPopover();
        }
    },
    internalOpenPopover: function() {
        const pop = document.getElementById('dice-settings-popover');
        const btn = document.getElementById('btn-action-expand');
        pop.classList.add('open');
        btn.classList.add('open');
        btn.innerText = '✕';
        if(window.Dice) window.Dice.refreshDiceUI();
    },
    internalClosePopover: function() {
        const pop = document.getElementById('dice-settings-popover');
        const btn = document.getElementById('btn-action-expand');
        pop.classList.remove('open');
        btn.classList.remove('open');
        btn.innerText = '+';
    },

    syncActionState: function(type) {
        const chkId = type === 'long' ? 'long-response' : 'dice-enable';
        const wrapId = type === 'long' ? 'toggle-long' : 'toggle-dice';
        const chk = document.getElementById(chkId);
        const wrap = document.getElementById(wrapId);
        if(chk.checked) wrap.classList.add('active');
        else wrap.classList.remove('active');
    },

    syncPanelsBeforeClose: function() { if(document.getElementById('world-panel').classList.contains('open')) Store.syncWorldDOM(); if(document.getElementById('char-panel').classList.contains('open')) Store.syncCharDOM(); },
    
    togglePanel: function(id) {
        if(App.isGenerating) return; this.syncPanelsBeforeClose();
        const p = document.getElementById(id);
        const pop = document.getElementById('dice-settings-popover');
        
        if(p.classList.contains('open')) { 
            if(App.isPanelOpen) history.back(); 
        } 
        else {
            // 🔥 Race Condition 해결: 주사위 팝업이 열려있으면 강제로 먼저 닫고 Panel 스택으로 교체
            if (pop && pop.classList.contains('open')) {
                this.internalClosePopover();
                history.replaceState({ panel: true }, "");
            } else {
                if(!App.isPanelOpen) { history.pushState({ panel: true }, ""); }
            }
            App.isPanelOpen = true;
            
            document.querySelectorAll('.panel').forEach(el => el.classList.remove('open')); 
            p.querySelectorAll('details[open]').forEach(d => d.removeAttribute('open'));
            p.classList.add('open'); 
            document.getElementById('overlay').classList.add('active');
            
            if(id==='world-panel') { 
                if(Store.state.activeRoomId) { document.getElementById('world-panel-title').innerText = "🗺️ 인게임 세계 설정"; document.getElementById('btn-free-roam').style.display = 'block'; } 
                else { document.getElementById('world-panel-title').innerText = "🌌 템플릿 원본 편집"; document.getElementById('btn-free-roam').style.display = 'none'; } 
                this.renderWorld(); 
            }
            if(id==='char-panel') { 
                if(!Store.state.activeRoomId) { 
                    document.getElementById('h3-my-char').style.display = 'none'; document.getElementById('h3-active-npc').style.display = 'none'; 
                    document.getElementById('h3-other-char').innerText = '👥 모든 인물';
                } else { 
                    document.getElementById('h3-my-char').style.display = 'block'; document.getElementById('h3-active-npc').style.display = 'block'; 
                    document.getElementById('h3-other-char').innerText = '👥 대기 중인 조연';
                } 
                this.renderCharFilter(); this.renderCharacters(); 
            } 
            if(id==='sys-panel') { 
                const r = Store.getActiveRoom();
                const memInput = document.getElementById('room-memory-input'); memInput.value = r.memory || ''; 
                const statInput = document.getElementById('global-status-input'); statInput.value = r.globalStatus || ''; 
                
                const sel = document.getElementById('network-preset-sel');
                if(sel) { sel.value = r.networkPreset || 'modern'; this.toggleCustomNet(sel.value); }
                
                this.renderNetworkArchive(); 
                setTimeout(() => {this.autoResize(memInput); this.autoResize(statInput);}, 10); 
            } 
        }
    },

    renderSafetyUI: function() {
        const container = document.getElementById('safety-checks'); if(!container) return;
        const labels = { 
            violence: "폭력 및 유혈", discrimination: "혐오 및 차별", sexual: "성적 표현", abuse: "학대 묘사", 
            selfharm: "자해 및 자살", drugs: "음주 및 약물", marysue: "과잉 찬양", obsession: "소유욕 및 집착",
            gore: "공포 및 기괴함", romance: "로맨스 전개"
        };
        container.innerHTML = Object.keys(Store.state.safety).map(key => {
            if (!labels[key]) return ''; 
            return `<label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer; font-size:0.85rem;"><input type="checkbox" ${Store.state.safety[key] ? 'checked' : ''} onchange="Store.state.safety.${key}=this.checked; Store.saveSettings();"> ${labels[key]}</label>`;
        }).join('');
    },

    renderScenarioList: function() {
        let filter = document.getElementById('lobby-room-filter').value;
        if (!filter) filter = 'all'; 
        
        const sortedRooms = [...Store.state.rooms].sort((a,b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
        document.getElementById('scenario-list').innerHTML = sortedRooms.map((r, idx) => {
            if(filter !== 'all' && !r.tagIds.includes(filter)) return ''; const isRecent = idx === 0 && r.lastUpdated;
            const tagsHtml = r.tagIds.map(tId => { const tObj = Store.state.roomTags.find(x => x.id === tId); return tObj ? `<span class="lobby-card-tag" style="background:#7c3aed;">${this.esc(tObj.name)} <button type="button" style="background:none;border:none;color:white;cursor:pointer;padding:0 2px;" onclick="App.removeRoomTag('${r.id}', '${tId}', event)">×</button></span> ` : ''; }).join('');
            const addTagSelect = Store.state.roomTags.filter(t => !r.tagIds.includes(t.id)).length > 0 ? `<select class="select-std" style="margin-top:6px; padding:4px; font-size:0.75rem; width:auto; display:inline-block;" onclick="event.stopPropagation()" onchange="App.addRoomTag('${r.id}', this, event)"><option value="">+ 태그</option>${Store.state.roomTags.filter(t => !r.tagIds.includes(t.id)).map(t => `<option value="${t.id}">${this.esc(t.name)}</option>`).join('')}</select>` : '';
            return `<div class="lobby-card ${isRecent ? 'recent' : ''}">${isRecent ? '<span class="lobby-card-tag" style="background:#dc2626;">🔥 이어하기</span> ' : ''}<div style="font-weight:bold; font-size:1.1rem; color:#fff;">${this.esc(r.name)}</div><div style="font-size:0.8rem; color:#aaa; margin-top:4px;">🌌 [${this.esc(r.worldInstance.name)}] | 턴: ${r.history.length}</div><div style="margin-top:8px;">${tagsHtml}${addTagSelect}</div><div class="card-btns"><button class="btn-play" onclick="App.enterRoom('${r.id}')">▶ 입장</button><button class="btn-play" style="background:#059669; max-width:40px;" onclick="App.extractTemplate('${r.id}')" title="템플릿으로 추출">🌌</button><button class="btn-play" style="background:#262626; max-width:40px;" onclick="App.editRoomInfo('${r.id}')">✏️</button><button class="btn-play" style="background:#262626; max-width:40px;" onclick="App.cloneRoom('${r.id}')">📋</button><button class="btn-play" style="background:#7f1d1d; max-width:40px;" onclick="App.deleteRoom('${r.id}')">✖</button></div></div>`;
        }).join('');
        const filterSel = document.getElementById('lobby-room-filter'); filterSel.innerHTML = '<option value="all">모든 시나리오 보기</option>' + Store.state.roomTags.map(t => `<option value="${t.id}" ${filterSel.value===t.id?'selected':''}>${this.esc(t.name)}</option>`).join('');
    },
    
    renderWorldTemplateList: function() { document.getElementById('world-template-list').innerHTML = Store.state.worlds.map(w => `<div class="lobby-card" style="border-left-color:#059669;"><div style="font-weight:bold; font-size:1.1rem; color:#fff;">${this.esc(w.name)}</div><div style="font-size:0.8rem; color:#aaa; margin-top:4px;">${w.characters.length - 1}명 / 🗺️ ${w.regions.length}지역 / 📍 ${w.locations.length}장소</div><div class="card-btns"><button class="btn-play" style="background:#059669;" onclick="App.editWorldTemplate('${w.id}')">🛠 템플릿 편집</button><button class="btn-play" style="background:#262626; max-width:40px;" onclick="Store.deleteWorldTemplate('${w.id}')">✖</button></div></div>`).join(''); },
    
    renderWorld: function() {
        const w = Store.getTargetWorld(); if(!w) return;

        const panel = document.getElementById('world-panel');
        const st = panel ? panel.scrollTop : 0; 

        let openState = [];
        if (panel && panel.classList.contains('open')) {
            panel.querySelectorAll('details[open]').forEach(d => { if(d.id) openState.push(d.id); });
        }

        const wnEl = document.getElementById('w-n'); if(wnEl) wnEl.value = w.name || ''; 
        const wdEl = document.getElementById('w-d'); if(wdEl) wdEl.value = w.prompt || ''; 
        const wurlEl = document.getElementById('w-url'); if(wurlEl) wurlEl.value = w.bgUrl || '';
        
        const facList = document.getElementById('world-factions-list');
        if(facList) facList.innerHTML = w.factions.map(f => `<details class="item-card card-faction" id="det-f-${f.id}" ontoggle="if(this.open) this.querySelectorAll('textarea').forEach(el=>UI.autoResize(el))"><summary>${this.esc(f.name) || '새 세력'}</summary><div style="margin-top:10px;"><input type="text" class="input-std" id="f-n-${f.id}" value="${this.esc(f.name)}" placeholder="세력명"><textarea class="area-std auto-resize" id="f-d-${f.id}" placeholder="특징" oninput="UI.autoResize(this);">${this.esc(f.desc)}</textarea><span class="secret-label">🔒 세력 비밀</span><textarea class="area-std auto-resize" id="f-s-${f.id}" oninput="UI.autoResize(this);">${this.esc(f.secret)}</textarea><button class="btn-danger" onclick="Store.delWorldItem('f','${f.id}', event)">삭제</button></div></details>`).join('');
        
        const folderMap = { '': [] }; w.loreFolders.forEach(lf => folderMap[lf.id] = []); w.lores.forEach(l => { if(folderMap[l.folderId]) folderMap[l.folderId].push(l); else folderMap[''].push(l); });
        const locOptions = `<option value="">(장소 조건 없음)</option>` + w.locations.map(loc => `<option value="${loc.id}">${this.esc(loc.name)}에서만 활성화</option>`).join('');
        const renderLoreItem = (l) => `<div class="item-card" style="margin-bottom:8px;"><details id="det-l-${l.id}" ontoggle="if(this.open) this.querySelectorAll('textarea').forEach(el=>UI.autoResize(el))"><summary style="color:#eee;">📄 ${this.esc(l.keyword) || '새 지식'}</summary><div style="margin-top:10px;"><select class="select-std" id="l-fld-${l.id}"><option value="">(상위 분류 없음)</option>${w.loreFolders.map(lf=>`<option value="${lf.id}" ${l.folderId===lf.id?'selected':''}>분류: ${this.esc(lf.name)}</option>`).join('')}</select><input type="text" class="input-std" id="l-n-${l.id}" value="${this.esc(l.keyword)}" placeholder="개념/키워드"><select class="select-std" id="l-trig-${l.id}">${locOptions}</select><textarea class="area-std auto-resize" id="l-d-${l.id}" oninput="UI.autoResize(this);">${this.esc(l.desc)}</textarea><button class="btn-danger" onclick="Store.delWorldItem('l','${l.id}', event)">삭제</button></div></details></div>`;
        
        const lfList = document.getElementById('world-lore-folders-list');
        if(lfList) {
            lfList.innerHTML = w.loreFolders.map(lf => `<details class="folder-box" id="det-lf-${lf.id}"><summary class="folder-title"><h4 style="margin:0;">📁 ${this.esc(lf.name) || '새 분류'}</h4><button class="mini-btn" onclick="Store.delWorldItem('lf','${lf.id}', event)">✖</button></summary><div style="margin-top:10px;"><input type="text" class="input-std" id="lf-n-${lf.id}" value="${this.esc(lf.name)}" placeholder="분류명"><textarea class="area-std auto-resize" id="lf-d-${lf.id}" placeholder="설명" oninput="UI.autoResize(this);">${this.esc(lf.desc)}</textarea><div style="margin-top:10px; padding-top:10px; border-top:1px dashed #333;">${folderMap[lf.id].map(renderLoreItem).join('')}<button class="btn-ghost" style="margin:0; padding:6px;" onclick="Store.addLore('${lf.id}')">+ 📄 이 분류에 지식 추가</button></div></div></details>`).join('');
            lfList.innerHTML += folderMap[''].length > 0 ? folderMap[''].map(renderLoreItem).join('') : '<p style="font-size:0.8rem; color:#666;">미분류 지식이 없습니다.</p>';
        }

        const r = Store.state.activeRoomId ? Store.getActiveRoom() : null;
        const locMap = { '': [] }; w.regions.forEach(reg => locMap[reg.id] = []); w.locations.forEach(loc => { if(locMap[loc.regionId]) locMap[loc.regionId].push(loc); else locMap[''].push(loc); });
        const renderLocItem = (loc, realIdx) => `<div class="item-card" style="margin-bottom:8px;"><details id="det-loc-${loc.id}" ontoggle="if(this.open) this.querySelectorAll('textarea').forEach(el=>UI.autoResize(el))"><summary>📍 ${this.esc(loc.name) || '새 장소'}</summary><div style="margin-top:10px;"><input type="text" class="input-std" id="loc-n-${loc.id}" value="${this.esc(loc.name)}" placeholder="장소명"><select class="select-std" id="loc-r-${loc.id}" style="margin-bottom:5px;"><option value="">(상위 지역 없음)</option>${w.regions.map(reg=>`<option value="${reg.id}" ${loc.regionId===reg.id?'selected':''}>지역: ${this.esc(reg.name)}</option>`).join('')}</select><textarea class="area-std auto-resize" id="loc-d-${loc.id}" placeholder="장소 특징" oninput="UI.autoResize(this);">${this.esc(loc.desc)}</textarea>${r ? `<button class="btn-main" style="background:${r.currentLocIdx===realIdx?'#fbbf24':'#333'}; color:${r.currentLocIdx===realIdx?'#000':'#fff'};" onclick="Store.setLoc(${realIdx})">${r.currentLocIdx===realIdx?'📍 현재 위치로 설정':'여기로 이동'}</button>` : ''}<button class="btn-danger" onclick="Store.delWorldItem('loc','${loc.id}', event)">삭제</button></div></details></div>`;
        
        const regList = document.getElementById('world-regions-list');
        if(regList) {
            regList.innerHTML = w.regions.map(reg => `<details class="folder-box" id="det-reg-${reg.id}"><summary class="folder-title"><h4 style="margin:0; color:#10b981;">🏔️ ${this.esc(reg.name) || '새 지역'}</h4><button class="mini-btn" onclick="Store.delWorldItem('reg','${reg.id}', event)">✖</button></summary><div style="margin-top:10px;"><input type="text" class="input-std" id="reg-n-${reg.id}" value="${this.esc(reg.name)}" placeholder="지역명"><textarea class="area-std auto-resize" id="reg-d-${reg.id}" placeholder="지역 특징" oninput="UI.autoResize(this);">${this.esc(reg.desc)}</textarea><div style="margin-top:10px; padding-top:10px; border-top:1px dashed #333;">${locMap[reg.id].map(loc=>renderLocItem(loc, w.locations.findIndex(x=>x.id===loc.id))).join('')}<button class="btn-ghost" style="margin:0; padding:6px;" onclick="Store.addLocation('${reg.id}')">+ 📍 이 지역에 장소 추가</button></div></div></details>`).join('');
            regList.innerHTML += locMap[''].length > 0 ? locMap[''].map(loc=>renderLocItem(loc, w.locations.findIndex(x=>x.id===loc.id))).join('') : '<p style="font-size:0.8rem; color:#666;">미분류 장소가 없습니다.</p>';
        }

        openState.forEach(id => { 
            const el = document.getElementById(id); 
            if(el) { el.open = true; el.querySelectorAll('textarea').forEach(t => UI.autoResize(t)); } 
        });
        
        if(panel) panel.scrollTop = st; 
    },

    renderCharFilter: function() { const w = Store.getTargetWorld(); if(!w) return; const sel = document.getElementById('char-filter-sel'); sel.innerHTML = `<option value="all">전체 세력 보기</option><option value="none">무소속 보기</option>` + w.factions.map(f => `<option value="${f.id}">${this.esc(f.name)}</option>`).join(''); },
    
    buildCharHTML: function(c, isMy, isNpc, w) {
        const statHtml = c.stats.map((s, sIdx) => `<div style="display:flex; gap:4px; margin-bottom:4px; align-items:center;"><label style="font-size:0.75rem; color:#aaa; cursor:pointer;"><input type="checkbox" title="적용" ${s.active!==false?'checked':''} onchange="Store.upStat('${c.id}', ${sIdx}, 'active', this.checked)"></label><input type="text" class="input-std" style="margin:0; flex:2; padding:6px;" placeholder="스탯명" value="${this.esc(s.n)}" onchange="Store.upStat('${c.id}', ${sIdx}, 'n', this.value)"><input type="number" class="input-std" style="margin:0; flex:1; padding:6px;" placeholder="수치" value="${s.v}" onchange="Store.upStat('${c.id}', ${sIdx}, 'v', this.value)"><button class="btn-danger" style="margin:0; padding:4px 8px; width:auto;" onclick="Store.delStat('${c.id}', ${sIdx})">✖</button></div>`).join('');
        const repHtml = c.reputation.map((rObj, rIdx) => `<div style="display:flex; flex-direction:column; gap:4px; margin-bottom:8px; padding:8px; background:rgba(0,0,0,0.2); border-radius:6px; border:1px solid #333;"><div style="display:flex; gap:4px; align-items:center;"><input type="text" class="input-std" style="margin:0; flex:1; padding:4px; font-size:0.75rem;" placeholder="좌측(예:악)" value="${this.esc(rObj.leftName)}" onchange="Store.upRep('${c.id}', ${rIdx}, 'leftName', this.value)"><span style="color:#666;">↔</span><input type="text" class="input-std" style="margin:0; flex:1; padding:4px; font-size:0.75rem;" placeholder="우측(예:선)" value="${this.esc(rObj.rightName)}" onchange="Store.upRep('${c.id}', ${rIdx}, 'rightName', this.value)"><button class="btn-danger" style="margin:0; padding:4px 8px; width:auto;" onclick="Store.delRep('${c.id}', ${rIdx})">✖</button></div><div style="display:flex; gap:10px; align-items:center; margin-top:4px;"><span style="font-size:0.75rem; color:#aaa; min-width:20px; text-align:right;" id="rep-val-${c.id}-${rIdx}">${rObj.value}</span><input type="range" min="-5" max="5" step="1" value="${rObj.value}" style="flex:1; cursor:pointer;" oninput="document.getElementById('rep-val-${c.id}-${rIdx}').innerText=this.value" onchange="Store.upRep('${c.id}', ${rIdx}, 'value', this.value)"></div></div>`).join('');
        let roleTag = ''; if(isMy) roleTag = '<span class="role-badge role-my">나의 캐릭터</span>'; else if(isNpc) roleTag = '<span class="role-badge role-npc">주연 (항시 참여)</span>';
        const locOpts = `<option value="">(조건 없음)</option>` + w.locations.map(loc => `<option value="${loc.id}" ${c.triggerLocId===loc.id?'selected':''}>${this.esc(loc.name)} 등장</option>`).join('');
        const r = Store.state.activeRoomId ? Store.getActiveRoom() : null;

        return `<details class="item-card card-char ${isMy?'my-char':''} ${isNpc?'active-npc':''} ${c.isHidden?'hidden':''}" id="det-c-${c.id}" ontoggle="if(this.open) this.querySelectorAll('textarea').forEach(el=>UI.autoResize(el))"><summary><div>${this.esc(c.keyword) || '새 인물'} ${roleTag}</div></summary><div style="margin-top:12px;"><div style="display:flex; justify-content:space-between; margin-bottom:8px;"><div style="display:flex; gap:5px;">${r && !isMy ? `<button onclick="Store.setMyChar('${c.id}')" class="btn-ghost" style="margin:0; padding:4px 8px; font-size:0.7rem;">🙋‍♂️ 내 캐릭터 지정</button>` : ''}${r && !isMy ? `<button onclick="Store.toggleActiveNpc('${c.id}')" class="btn-ghost" style="margin:0; padding:4px 8px; font-size:0.7rem; border-color:${isNpc?'#10b981':'#444'}; color:${isNpc?'#10b981':'#aaa'};">${isNpc?'🗣️ 주연 해제':'🗣️ 주연 추가'}</button>` : ''}</div><label style="font-size:0.8rem; color:#aaa; cursor:pointer;"><input type="checkbox" ${c.isHidden?'checked':''} onchange="Store.toggleHidden('${c.id}')"> 👁️ 숨김</label></div><input type="text" class="input-std" id="c-n-${c.id}" value="${this.esc(c.keyword)}" placeholder="이름" ${c.id==='sys'?'readonly':''}>${c.id!=='sys' ? `<div style="font-size:0.75rem; color:#888; margin-bottom:2px;">소속 세력:</div><div id="c-f-tags-${c.id}" class="tag-area"></div><input type="hidden" id="c-f-hid-${c.id}" value="${c.factionIds.join(',')}"><select class="select-std" style="margin-bottom:5px;" onchange="Store.addFacTag('${c.id}', this)"><option value="">+ 세력 추가...</option>${w.factions.map(fac=>`<option value="${fac.id}">${this.esc(fac.name)}</option>`).join('')}</select><select class="select-std" id="c-trig-${c.id}">${locOpts}</select>` : ''}<textarea class="area-std auto-resize" id="c-d-${c.id}" placeholder="설명" oninput="UI.autoResize(this);">${this.esc(c.desc)}</textarea><span class="secret-label">🔒 인물 비밀</span><textarea class="area-std auto-resize" id="c-s-${c.id}" oninput="UI.autoResize(this);">${this.esc(c.secret)}</textarea><div style="margin-top:10px; border-top:1px dashed #333; padding-top:10px;"><span style="font-size:0.8rem; font-weight:bold; color:#fbbf24;">📊 스탯</span><div style="margin-top:6px;">${statHtml}</div><button class="btn-ghost" style="padding:4px; font-size:0.75rem; margin:0;" onclick="Store.addStat('${c.id}')">+ 스탯 추가</button></div><details class="acc-sec" id="det-c-rep-${c.id}" style="margin-top:10px; padding:8px; background:rgba(255,255,255,0.02); border:1px solid #333;"><summary style="font-size:0.8rem; color:#a78bfa; padding-bottom:0;">⚖️ 평판 및 성향</summary><div style="margin-top:8px;">${repHtml}<button class="btn-ghost" style="padding:4px; font-size:0.75rem; margin:0;" onclick="Store.addRep('${c.id}')">+ 성향 축 추가</button></div></details>${c.id!=='sys' ? `<button class="btn-danger" style="margin-top:15px;" onclick="Store.delChar('${c.id}')">인물 완전 삭제</button>` : ''}</div></details>`;
    },
    
    renderCharacters: function() {
        const w = Store.getTargetWorld(); const r = Store.state.activeRoomId ? Store.getActiveRoom() : null; const filterVal = document.getElementById('char-filter-sel').value;
        const filterFn = c => { if(filterVal === 'all') return true; if(filterVal === 'none') return !c.factionIds || c.factionIds.length === 0; return c.factionIds.includes(filterVal); };
        
        const panel = document.getElementById('char-panel');
        const st = panel ? panel.scrollTop : 0; 

        let openState = [];
        if (panel && panel.classList.contains('open')) {
            panel.querySelectorAll('details[open]').forEach(d => { if(d.id) openState.push(d.id); });
        }

        if(r) {
            const my = w.characters.find(c=>c.id===r.myCharId); const act = w.characters.filter(c=>r.activeCharIds.includes(c.id) && c.id!==r.myCharId && c.id!=='sys' && filterFn(c)); const oth = w.characters.filter(c=>!r.activeCharIds.includes(c.id) && c.id!==r.myCharId && c.id!=='sys' && filterFn(c));
            document.getElementById('char-my-area').innerHTML = my && filterFn(my) ? this.buildCharHTML(my, true, false, w) : ''; document.getElementById('char-active-area').innerHTML = act.map(c=>this.buildCharHTML(c, false, true, w)).join(''); document.getElementById('char-other-area').innerHTML = oth.map(c=>this.buildCharHTML(c, false, false, w)).join('');
        } else {
            const oth = w.characters.filter(c=>c.id!=='sys' && filterFn(c)); document.getElementById('char-my-area').innerHTML = ''; document.getElementById('char-active-area').innerHTML = ''; document.getElementById('char-other-area').innerHTML = oth.map(c=>this.buildCharHTML(c, false, false, w)).join('');
        }
        w.characters.forEach(c => { if(c.id !== 'sys') this.renderFacTags(c.id); });

        openState.forEach(id => { 
            const el = document.getElementById(id); 
            if(el) { el.open = true; el.querySelectorAll('textarea').forEach(t => UI.autoResize(t)); } 
        });
        
        if(panel) panel.scrollTop = st; 
    },
    
    renderFacTags: function(cId) { const hid = document.getElementById(`c-f-hid-${cId}`); const area = document.getElementById(`c-f-tags-${cId}`); if(!hid || !area) return; const fIds = hid.value ? hid.value.split(',') : []; const w = Store.getTargetWorld(); area.innerHTML = fIds.map(fId => { const fac = w.factions.find(f => f.id === fId); return fac ? `<span class="fac-tag">${this.esc(fac.name)} <button type="button" onclick="Store.removeFacTag('${cId}', '${fId}')">×</button></span>` : ''; }).join(''); },

    openNewRoomModal: function() { 
        const nameEl = document.getElementById('new-room-name'); if(nameEl) nameEl.value = ''; 
        const opts = Store.state.worlds.map(w => `<option value="${w.id}">${this.esc(w.name)}</option>`).join('');
        const selEl = document.getElementById('new-room-world-sel'); if(selEl) selEl.innerHTML = opts || `<option value="" disabled selected>세계관 없음</option>`;
        this.openModal('new-room-modal'); 
    },
    openImportModal: function() { document.getElementById('import-world-sel').innerHTML = `<option value="">세계관 원본 선택...</option>` + Store.state.worlds.map(w=>`<option value="${w.id}">${this.esc(w.name)}</option>`).join(''); document.getElementById('import-char-list').innerHTML = ''; this.openModal('import-modal'); },
    renderImportChars: function() { const wId = document.getElementById('import-world-sel').value; const list = document.getElementById('import-char-list'); if(!wId) return list.innerHTML = ''; const tr = Store.state.worlds.find(w=>w.id===wId); list.innerHTML = tr.characters.filter(c=>c.id!=='sys').map(c => `<div style="background:#111; padding:10px; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;"><span style="font-weight:bold;">${this.esc(c.keyword)}</span><button class="auto-btn" style="padding:4px 8px; margin:0;" onclick="App.importChar('${wId}', '${c.id}')">가져오기</button></div>`).join(''); },
    openTagModal: function() { this.renderTagManageList(); this.openModal('tag-manage-modal'); },
    renderTagManageList: function() { const list = document.getElementById('tag-manage-list'); if(Store.state.roomTags.length === 0) return list.innerHTML = '<p style="color:#888; font-size:0.85rem;">생성된 태그가 없습니다.</p>'; list.innerHTML = Store.state.roomTags.map(t => `<div style="background:#111; padding:10px; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; border:1px solid #333;"><input type="text" class="input-std" style="margin:0; width:70%; padding:6px;" value="${this.esc(t.name)}" onchange="App.updateRoomTag('${t.id}', this.value)"><button class="btn-danger" style="margin:0; width:auto; padding:6px 12px;" onclick="App.deleteRoomTag('${t.id}')">삭제</button></div>`).join(''); },

    updateActionBtn: function() { const val = document.getElementById('msg-input').value.trim(); const btn = document.getElementById('action-btn'); if(val) { btn.innerText = "전송"; btn.style.background = "var(--accent-color)"; } else { btn.innerText = "▶ 진행"; btn.style.background = "#059669"; } },
    appendMessageDOM: function(m, idx) {
        const r = Store.getActiveRoom(); const w = r.worldInstance; const container = document.getElementById('chat-container'); const d = document.createElement('div'); d.className = `message ${m.role}`; d.setAttribute('data-idx', idx);
        if(m.role === 'user') { const speaker = document.createElement('div'); speaker.className = 'speaker-name'; const myC = w.characters.find(c=>c.id===r.myCharId); speaker.innerText = myC ? myC.keyword : 'USER'; d.appendChild(speaker); }
        const t = document.createElement('div'); t.className = 'msg-text'; t.innerHTML = this.formatMsg(m.variants[m.currentVariant], m.role); d.appendChild(t);
        if(m.variants[m.currentVariant] !== "") d.appendChild(this.createCtrls(idx)); container.appendChild(d); return d;
    },
    formatMsg: function(t, role) { 
        let res = this.esc(t);
        if(role === 'ai') res = res.split('\n').map(line => { const match = line.match(/^\s*([^\(\[\~:<*]{1,20})\s*:\s*(.+)$/); if (match) return `<div class="speech-bubble"><div class="speech-name">${match[1].trim()}</div><div class="speech-content">${match[2]}</div></div>`; return line; }).join('\n');
        res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"); res = res.replace(/\*(.*?)\*/g, "<em>$1</em>");
        if(role === 'user') res = res.replace(/\((.*?)\)/g, "<span class='action'>($1)</span>"); return res.replace(/\n/g, "<br>"); 
    },
    createCtrls: function(idx) {
        const r = Store.getActiveRoom(); const m = r.history[idx]; const c = document.createElement('div'); c.className = 'msg-controls'; const isLastAi = idx === r.history.findLastIndex(msg => msg.role === 'ai');
        if(m.role==='ai') {
            if(isLastAi) { const rb = document.createElement('button'); rb.innerText="재생성"; rb.onclick=()=>App.runAI(true,idx); c.append(rb); }
            const bb = document.createElement('button'); bb.innerText="분기"; bb.onclick=()=>App.branch(idx); const stb = document.createElement('button'); stb.className="btn-stat-up"; stb.innerText="📊 갱신(스탯/성향)"; stb.onclick=()=>App.processStatUpdate(idx); c.append(bb, stb);
            if(m.variants.length>1) { const p = document.createElement('button'); p.innerText="<"; p.onclick=()=>{m.currentVariant=(m.currentVariant+m.variants.length-1)%m.variants.length; App.loadActiveRoom(true);}; const n = document.createElement('button'); n.innerText=">"; n.onclick=()=>{m.currentVariant=(m.currentVariant+1)%m.variants.length; App.loadActiveRoom(true);}; const s = document.createElement('span'); s.innerText=`${m.currentVariant+1}/${m.variants.length}`; c.append(p, s, n); }
        }
        const eb = document.createElement('button'); eb.innerText="수정"; eb.onclick=()=>this.enterEdit(idx); const rw = document.createElement('button'); rw.className = "btn-rewind"; rw.innerText="되감기"; rw.onclick=()=>App.rewindRoom(idx); const db = document.createElement('button'); db.innerText="삭제"; db.onclick=()=>{ if(!confirm("삭제하시겠습니까?")) return; r.history.splice(idx,1); Store.forceSave(); App.loadActiveRoom(true); }; 
        c.append(eb, rw, db); return c;
    },
    enterEdit: function(idx) { 
        const r = Store.getActiveRoom(); const m = r.history[idx]; const msgDiv = document.querySelector(`.message[data-idx="${idx}"]`); if(!msgDiv) return;
        const textEl = msgDiv.querySelector('.msg-text'); const ctrlEl = msgDiv.querySelector('.msg-controls'); textEl.style.display = 'none'; ctrlEl.style.display = 'none';
        const editArea = document.createElement('textarea'); editArea.className = 'area-std auto-resize'; editArea.value = m.variants[m.currentVariant]; editArea.oninput = () => { this.autoResize(editArea); };
        const btnWrap = document.createElement('div'); btnWrap.style.display = 'flex'; btnWrap.style.gap = '5px'; btnWrap.style.marginTop = '5px';
        const sBtn = document.createElement('button'); sBtn.className = 'btn-main'; sBtn.innerText = '저장'; sBtn.style.marginTop = '0';
        const cBtn = document.createElement('button'); cBtn.className = 'btn-ghost'; cBtn.innerText = '취소'; cBtn.style.marginBottom = '0';
        
        sBtn.onclick = () => { if(!confirm("수정하시겠습니까?")) return; if(editArea.value.trim()){ m.variants[m.currentVariant] = editArea.value; Store.forceSave(); App.loadActiveRoom(true); } };
        cBtn.onclick = () => { App.loadActiveRoom(true); }; 
        btnWrap.append(sBtn, cBtn); msgDiv.append(editArea, btnWrap); setTimeout(() => this.autoResize(editArea), 10);
    },

    toggleCustomNet: function(val) {
        const el = document.getElementById('custom-net-input');
        if(el) el.style.display = (val === 'custom') ? 'block' : 'none';
        Store.updateRoomState('networkPreset', val);
        Store.forceSave();
    },

    renderNetworkArchive: function() { 
        const r = Store.getActiveRoom(); 
        let raw = r.networkArchive || "정보가 없습니다. 스캔을 실행하세요.";
        if(raw.includes('스캔 중')) return document.getElementById('network-content').innerHTML = raw;
        
        let fmt = raw.replace(/\[(.*?)\]/g, (match) => {
            return `</div></div><div class="net-entry"><span class="net-tag tag-universal">${match}</span><div style="margin-top:8px;">`;
        });

        fmt = fmt.replace(/\n[ㄴ└]\s?(.*)/g, '<div class="net-comment">ㄴ $1</div>');
        
        fmt = fmt.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>");
        
        if(fmt.startsWith('</div></div>')) fmt = fmt.substring(12);
        document.getElementById('network-content').innerHTML = fmt + (fmt.includes('net-entry') ? '</div></div>' : ''); 
    },
    
    editNetwork: function(isEdit = true) {
        const r = Store.getActiveRoom(); const cDiv = document.getElementById('network-content'); const eArea = document.getElementById('network-edit-area'); const sBtn = document.getElementById('network-save-btn');
        if (isEdit && eArea.style.display === 'none') {
            let txt = r.networkArchive || '';
            if(txt.includes('<div')) {
                txt = txt.replace(/<br\s*\/?>/gi, '\n');
                txt = txt.replace(/<[^>]*>?/gm, '');
            }
            eArea.value = txt.trim(); 
            cDiv.style.display = 'none'; eArea.style.display = 'block'; sBtn.style.display = 'block'; setTimeout(() => this.autoResize(eArea), 10);
        } else { cDiv.style.display = 'block'; eArea.style.display = 'none'; sBtn.style.display = 'none'; }
    }
};
