window.UI = {
    activeModal: null,
    lastFocusedWorldInput: null, 
    lastFocusedCharInput: null,

    esc: function(s) { return s === undefined || s === null ? '' : s.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); },
    
    autoResize: function(el) { 
        if (!el) return; 
        el.style.height = '1px'; 
        const maxH = 300; 
        if (el.scrollHeight >= maxH) { el.style.height = maxH + 'px'; el.style.overflowY = 'auto'; } 
        else { el.style.height = el.scrollHeight + 'px'; el.style.overflowY = 'hidden'; }
        if (el.id === 'msg-input') this.scrollToBottom(true); 
    },

    scrollToBottom: function(instant = false) { const c = document.getElementById('chat-container'); if(instant) c.scrollTop = c.scrollHeight; else c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' }); },
    
    showToast: function(msg) { const t = document.getElementById('toast-noti'); t.innerText=msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); },
    
    showAILoader: function(msg) { 
        const ld = document.getElementById('global-ai-loader'); 
        const txt = document.getElementById('loader-msg'); 
        if(ld) { 
            if(txt) txt.innerHTML = msg + '<span class="anim-dots"></span>'; 
            ld.classList.add('show'); 
        } 
    },
    
    hideAILoader: function() { const ld = document.getElementById('global-ai-loader'); if(ld) ld.classList.remove('show'); },

    switchTab: function(id, e) { document.querySelectorAll('.lobby-tab').forEach(t=>t.classList.remove('active')); document.querySelectorAll('.lobby-content').forEach(c=>c.classList.remove('active')); e.target.classList.add('active'); document.getElementById(id).classList.add('active'); if(id === 'tab-scenarios') this.renderScenarioList(); if(id === 'tab-worlds') this.renderWorldTemplateList(); },
    
    openModal: function(id) { 
        this.activeModal = id;
        document.getElementById(id).style.display = 'block'; 
        document.getElementById('overlay').classList.add('active'); 
        history.pushState({ modal: id }, ""); 
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
        if(this.activeModal) { history.back(); } 
        else if (App.isPanelOpen) { history.back(); }
    },

    toggleActionPopover: function() {
        const pop = document.getElementById('dice-settings-popover');
        if(pop.classList.contains('open')) { history.back(); } 
        else { history.pushState({ popover: true }, ""); this.internalOpenPopover(); }
    },
    internalOpenPopover: function() {
        const pop = document.getElementById('dice-settings-popover');
        const btn = document.getElementById('btn-action-expand');
        pop.classList.add('open'); btn.classList.add('open'); btn.innerText = '✕';
        if(window.Dice) window.Dice.refreshDiceUI();
    },
    internalClosePopover: function() {
        const pop = document.getElementById('dice-settings-popover');
        const btn = document.getElementById('btn-action-expand');
        pop.classList.remove('open'); btn.classList.remove('open'); btn.innerText = '+';
    },

    syncActionState: function(type) {
        const chkId = type === 'long' ? 'long-response' : 'dice-enable';
        const wrapId = type === 'long' ? 'toggle-long' : 'toggle-dice';
        const chk = document.getElementById(chkId);
        const wrap = document.getElementById(wrapId);
        if(chk.checked) wrap.classList.add('active'); else wrap.classList.remove('active');
    },

    syncPanelsBeforeClose: function() { if(document.getElementById('world-panel').classList.contains('open')) Store.syncWorldDOM(); if(document.getElementById('char-panel').classList.contains('open')) Store.syncCharDOM(); },
    
    togglePanel: function(id) {
        if(App.isGenerating) return; this.syncPanelsBeforeClose();
        const p = document.getElementById(id);
        const pop = document.getElementById('dice-settings-popover');
        
        if(p.classList.contains('open')) { 
            if(App.isPanelOpen) history.back(); 
        } else {
            if (pop && pop.classList.contains('open')) { this.internalClosePopover(); history.replaceState({ panel: true }, ""); } 
            else { if(!App.isPanelOpen) { history.pushState({ panel: true }, ""); } }
            App.isPanelOpen = true;
            
            document.querySelectorAll('.panel').forEach(el => el.classList.remove('open')); 
            
            p.querySelectorAll('details[open]').forEach(d => {
                if(d.id !== 'det-basic-settings') d.removeAttribute('open');
            });
            
            p.classList.add('open'); 
            document.getElementById('overlay').classList.add('active');
            
            // 🔥 패널 열 때마다 마법봉 포커스 강제 클리어
            if(id==='world-panel') { 
                if(Store.state.activeRoomId) { document.getElementById('world-panel-title').innerText = "🗺️ 인게임 세계 설정"; document.getElementById('btn-free-roam').style.display = 'block'; } 
                else { document.getElementById('world-panel-title').innerText = "🌌 템플릿 원본 편집"; document.getElementById('btn-free-roam').style.display = 'none'; } 
                this.lastFocusedWorldInput = null;
                const mBtn = document.getElementById('magic-btn');
                if(mBtn) { mBtn.disabled = true; mBtn.style.opacity = '0.3'; mBtn.style.boxShadow = 'none'; }
                this.renderWorld(); 
            }
            if(id==='char-panel') { 
                if(!Store.state.activeRoomId) { document.getElementById('h3-my-char').style.display = 'none'; document.getElementById('h3-active-npc').style.display = 'none'; document.getElementById('h3-other-char').innerText = '👥 모든 인물'; } 
                else { document.getElementById('h3-my-char').style.display = 'block'; document.getElementById('h3-active-npc').style.display = 'block'; document.getElementById('h3-other-char').innerText = '👥 대기 중인 조연'; } 
                this.lastFocusedCharInput = null;
                const cBtn = document.getElementById('char-magic-btn');
                if(cBtn) { cBtn.disabled = true; cBtn.style.opacity = '0.3'; cBtn.style.boxShadow = 'none'; }
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

    openNewRoomModal: function() { 
        const nameEl = document.getElementById('new-room-name'); if(nameEl) nameEl.value = ''; 
        const opts = Store.state.worlds.map(w => `<option value="${w.id}">${this.esc(w.name)}</option>`).join('');
        const selEl = document.getElementById('new-room-world-sel'); if(selEl) selEl.innerHTML = opts || `<option value="" disabled selected>세계관 없음</option>`;
        this.openModal('new-room-modal'); 
    },
    openImportModal: function() { document.getElementById('import-world-sel').innerHTML = `<option value="">세계관 원본 선택...</option>` + Store.state.worlds.map(w=>`<option value="${w.id}">${this.esc(w.name)}</option>`).join(''); document.getElementById('import-char-list').innerHTML = ''; this.openModal('import-modal'); },
    openTagModal: function() { this.renderTagManageList(); this.openModal('tag-manage-modal'); },

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
    
    editNetwork: function(isEdit = true) {
        const r = Store.getActiveRoom(); const cDiv = document.getElementById('network-content'); const eArea = document.getElementById('network-edit-area'); const sBtn = document.getElementById('network-save-btn');
        if (isEdit && eArea.style.display === 'none') {
            let txt = r.networkArchive || '';
            if(txt.includes('<div')) { txt = txt.replace(/<br\s*\/?>/gi, '\n'); txt = txt.replace(/<[^>]*>?/gm, ''); }
            eArea.value = txt.trim(); 
            cDiv.style.display = 'none'; eArea.style.display = 'block'; sBtn.style.display = 'block'; setTimeout(() => this.autoResize(eArea), 10);
        } else { cDiv.style.display = 'block'; eArea.style.display = 'none'; sBtn.style.display = 'none'; }
    }
};
