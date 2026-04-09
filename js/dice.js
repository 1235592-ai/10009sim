window.Dice = {
    renderOptions: function(chars, hideValue) {
        let html = '';
        chars.forEach(c => {
            if(c.stats) c.stats.filter(s=>s.active!==false).forEach(s => {
                const label = hideValue ? `${UI.esc(c.keyword)} - ${UI.esc(s.n)}` : `${UI.esc(c.keyword)} - ${UI.esc(s.n)}(${s.v})`;
                html += `<option value="${c.id}|${UI.esc(s.n)}|${s.v}">${label}</option>`;
            });
        });
        return html;
    },

    refreshDiceUI: function() { 
        const r = Store.getActiveRoom(); if(!r) return; 
        const w = r.worldInstance; 
        const my = w.characters.find(c=>c.id===r.myCharId); 
        const npcs = r.activeCharIds.map(id => w.characters.find(c=>c.id===id)).filter(c=>c&&c.id!=='sys'); 
        
        const mySel = document.getElementById('dice-my-stat').value;
        const npcSel = document.getElementById('dice-npc-stat').value;

        const myHtml = my ? this.renderOptions([my], false) : '';
        document.getElementById('dice-my-stat').innerHTML = myHtml || `<option value="">스탯 없음</option>`;
        
        const npcHtml = this.renderOptions(npcs, true);
        document.getElementById('dice-npc-stat').innerHTML = npcHtml || `<option value="">스탯 없음</option>`;
        
        if(mySel) document.getElementById('dice-my-stat').value = mySel;
        if(npcSel) document.getElementById('dice-npc-stat').value = npcSel;
        
        this.updateModeUI(); 
    },
    
    updateModeUI: function() { 
        const t = document.getElementById('dice-type').value; 
        const myStat = document.getElementById('dice-my-stat');
        const npcStat = document.getElementById('dice-npc-stat');
        const vsTxt = document.getElementById('dice-vs-txt');
        const custContainer = document.getElementById('dice-custom-container');
        
        if(t === 'single') { 
            myStat.style.display = 'inline-block'; vsTxt.style.display = 'none'; npcStat.style.display = 'none'; custContainer.style.display = 'none'; 
        } else if(t === 'opposed') { 
            myStat.style.display = 'inline-block'; vsTxt.style.display = 'inline'; npcStat.style.display = 'inline-block'; custContainer.style.display = 'none'; 
        } else if(t === 'custom') {
            myStat.style.display = 'none'; vsTxt.style.display = 'none'; npcStat.style.display = 'none'; custContainer.style.display = 'flex';
        }
    },

    onChangeType: function() {
        this.refreshDiceUI(); 
    },

    calcRoll: function(stat) { 
        const roll = Math.floor(Math.random() * 100) + 1; 
        const crit = Math.max(2, Math.floor(stat * 0.1)); 
        const failRange = 100 - stat; 
        const fumbleRange = Math.max(1, Math.ceil(failRange * 0.05)); 
        const fumble = stat >= 100 ? 101 : (100 - fumbleRange + 1); 
        
        let res = '실패 💧'; let level = 1; 
        
        if(roll === 1 || roll <= crit) { res = '대성공 🌟'; level = 3; } 
        else if(roll >= fumble) { res = '대실패 💀'; level = 0; } 
        else if(roll <= stat) { res = '성공 ✅'; level = 2; } 
        
        return { roll, stat, res, level, margin: stat - roll }; 
    },

    getDiceResultStr: function() { 
        if(!document.getElementById('dice-enable').checked) return ""; 
        const type = document.getElementById('dice-type').value;
        
        if (type === 'custom') {
            const obj = document.getElementById('dice-custom-obj').value.trim();
            const n = Math.max(1, Math.min(20, parseInt(document.getElementById('dice-custom-n').value) || 1));
            const sides = Math.max(2, Math.min(1000, parseInt(document.getElementById('dice-custom-sides').value) || 20));

            let total = 0;
            let rolls = [];
            for(let i = 0; i < n; i++) {
                let r = Math.floor(Math.random() * sides) + 1;
                rolls.push(r);
                total += r;
            }

            const detail = `${n}d${sides}`;
            const rollStr = rolls.join(' + ');
            const title = obj ? `커스텀 굴림 (${obj})` : `커스텀 굴림`;
            
            let resStr = `[🎲 ${title}: ${detail} → ${rollStr}`;
            if (n !== 1) resStr += ` = ${total}`;
            resStr += `]\n`;
            
            return resStr;
        }

        const isOpp = type === 'opposed'; 
        const v1 = document.getElementById('dice-my-stat').value; if(!v1) return ""; 
        const [i1, n1, val1] = v1.split('|'); const r1 = this.calcRoll(Number(val1)); 
        
        if(!isOpp) {
            return `[🎲 ${n1} 판정: D100 → ${r1.roll} / ${r1.stat} → ${r1.res}]\n`; 
        } else { 
            const v2 = document.getElementById('dice-npc-stat').value; if(!v2) return ""; 
            const [i2, n2, val2] = v2.split('|'); const r2 = this.calcRoll(Number(val2)); 
            
            let winner = '무승부 🤝 (마스터 판단)'; 
            if(r1.level > r2.level) winner = '플레이어 우위 👑'; 
            else if(r1.level < r2.level) winner = '상대 우위 ⚠️'; 
            else { 
                if(r1.margin > r2.margin) winner = '플레이어 우위 👑'; 
                else if(r1.margin < r2.margin) winner = '상대 우위 ⚠️'; 
            } 
            
            return `[⚔️ 대항 판정]\n- 플레이어(${n1}): D100 → ${r1.roll}/${r1.stat} [${r1.res}]\n- 상대(${n2}): D100 → ${r2.roll}/${r2.stat} [${r2.res}]\n▶ 결과: ${winner}\n`; 
        } 
    }
};
