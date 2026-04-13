window.API = {
    streamGemini: async function(contents, sysText, onChunk) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${Store.state.modelName}:streamGenerateContent?key=${Store.state.apiKey}&alt=sse`;
        const body = { 
            contents, 
            safetySettings: [ 
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, 
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, 
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, 
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } 
            ], 
            generationConfig: { temperature: 0.85 } 
        };
        if(sysText) body.system_instruction = { parts: [{ text: sysText }] };
        
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if(!res.ok) { const errText = await res.text(); throw new Error(errText); }

        const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
        while(true) {
            const {done, value} = await reader.read(); if(done) break;
            buffer += decoder.decode(value, {stream: true});
            const lines = buffer.split('\n'); buffer = lines.pop();
            for(const line of lines) {
                if(line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim(); if(dataStr === '[DONE]') continue;
                    try { const json = JSON.parse(dataStr); const chunk = json.candidates?.[0]?.content?.parts?.[0]?.text || ""; if(chunk) onChunk(chunk); } catch(e) {}
                }
            }
        }
    },

    callGemini: async function(contents, sysText, options={}) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${Store.state.modelName}:generateContent?key=${Store.state.apiKey}`;
        const body = { 
            contents, 
            safetySettings: [ 
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, 
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, 
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, 
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } 
            ], 
            generationConfig: { 
                temperature: options.temp || 0.85, 
                responseMimeType: options.jsonMode ? "application/json" : "text/plain" 
            } 
        };
        if(sysText) body.system_instruction = { parts: [{ text: sysText }] };
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if(!res.ok) throw new Error("API 연동 실패"); const data = await res.json();
        if(!data.candidates?.[0]) throw new Error("응답 없음");
        return data.candidates[0].content.parts[0].text;
    },

    parseAIJsonRaw: function(text) {
        if (!text) return null;
        let clean = text.replace(/```json/ig, '').replace(/```/ig, '').trim();
        try { return JSON.parse(clean); } catch(e) {}
        try {
            let firstBrace = clean.indexOf('{'); let firstBracket = clean.indexOf('['); let startIdx = -1, endIdx = -1;
            if (firstBrace !== -1 && firstBracket !== -1) { if (firstBrace < firstBracket) { startIdx = firstBrace; endIdx = clean.lastIndexOf('}'); } else { startIdx = firstBracket; endIdx = clean.lastIndexOf(']'); } } 
            else if (firstBrace !== -1) { startIdx = firstBrace; endIdx = clean.lastIndexOf('}'); } 
            else if (firstBracket !== -1) { startIdx = firstBracket; endIdx = clean.lastIndexOf(']'); }
            if (startIdx !== -1 && endIdx !== -1) { let sub = clean.substring(startIdx, endIdx + 1); sub = sub.replace(/,\s*([\]}])/g, '$1'); sub = sub.replace(/[\u0000-\u0019]+/g, ""); return JSON.parse(sub); }
            return null;
        } catch (err) { return null; }
    },

    getBatchEmbeddings: async function(texts) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${Store.state.apiKey}`;
        const body = { requests: texts.map(t => ({ model: "models/text-embedding-004", content: { parts: [{ text: t }] } })) };
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error("임베딩 API 호출 실패");
        const data = await res.json();
        return data.embeddings.map(e => e.values);
    },

    cosineSimilarity: function(vecA, vecB) {
        let dotProduct = 0; let normA = 0; let normB = 0;
        for (let i = 0; i < vecA.length; i++) { dotProduct += vecA[i] * vecB[i]; normA += vecA[i] * vecA[i]; normB += vecB[i] * vecB[i]; }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    },

    generateWorldSketch: async function(keywords) {
        const p = `제공된 핵심 키워드: [${keywords.join(', ')}]\n이 키워드들을 바탕으로 매우 흥미롭고 개연성 있는 세계관의 뼈대를 설계해라. 오직 JSON 객체만 반환할 것.\n포맷:\n{\n  "name": "세계관의 이름",\n  "prompt": "세계관의 전반적인 배경 요약 (300자 내외)",\n  "factions": [{"name": "세력명", "desc": "설명"}],\n  "lores": [{"name": "지식/설정명", "desc": "설명"}],\n  "locations": [{"name": "장소명", "desc": "설명"}]\n}\n※ 세력, 지식, 장소는 각각 정확히 3개씩 작성할 것.`;
        const text = await this.callGemini([{role:'user', parts:[{text: p}]}], "당신은 세계관 창조 마스터.", {temp: 0.8, jsonMode: true});
        return this.parseAIJsonRaw(text);
    },

    generateMoreKeywords: async function(existingKeywords) {
        if (!existingKeywords || existingKeywords.length === 0) {
            const p = `세계관을 만들기 위한 멋진 핵심 키워드 3개를 제안해. 다른 설명 없이 오직 콤마(,)로 구분된 단어 3개만 반환해.`;
            return await this.callGemini([{role:'user', parts:[{text: p}]}], null, {temp: 0.9});
        }
        const p = `현재 세계관 키워드: [${existingKeywords.join(', ')}]\n이 세계관을 더 매력적이고 입체적으로 확장하기 위해, 기존 단어의 단순 유의어가 아닌 '새로운 관점이나 갈등 요소'를 제공할 수 있는 핵심 키워드 10개를 제안해. 다른 설명 없이 오직 콤마(,)로 구분된 단어 10개만 반환해.`;
        const text = await this.callGemini([{role:'user', parts:[{text: p}]}], null, {temp: 1.0});
        
        let candidates = text.split(',').map(k => k.replace(/[\s#]/g, '').trim()).filter(k => k && !existingKeywords.includes(k));
        if (candidates.length === 0) return "";

        try {
            const allWords = [...existingKeywords, ...candidates];
            const embeddings = await this.getBatchEmbeddings(allWords);
            const existingVecs = embeddings.slice(0, existingKeywords.length);
            const candidateVecs = embeddings.slice(existingKeywords.length);

            let validCandidates = [];
            for (let i = 0; i < candidates.length; i++) {
                let maxSim = 0;
                for (let j = 0; j < existingVecs.length; j++) {
                    const sim = this.cosineSimilarity(candidateVecs[i], existingVecs[j]);
                    if (sim > maxSim) maxSim = sim;
                }
                if (maxSim < 0.85 && maxSim > 0.35) validCandidates.push({ word: candidates[i], sim: maxSim });
            }
            if (validCandidates.length < 3) return candidates.slice(0, 3).join(', ');
            validCandidates.sort((a, b) => Math.abs(a.sim - 0.55) - Math.abs(b.sim - 0.55));
            return validCandidates.slice(0, 3).map(c => c.word).join(', ');
        } catch (e) {
            return candidates.slice(0, 3).join(', ');
        }
    },

    generateDetail: async function(typeStr, keywords, title, desc, mode) {
        let p = `세계관 전체 키워드: [${keywords.join(', ')}]\n타겟 항목: ${typeStr}\n`;
        if (mode === 'full') { p += `\n지시: 이 항목의 '이름(title)'과 '상세 설정(desc)'을 모두 창작해서 JSON 객체로 반환해라. 내용은 300자 이상 아주 구체적으로 적을 것.\n포맷: {"title": "이름", "desc": "상세 내용"}`; const text = await this.callGemini([{role:'user', parts:[{text: p}]}], null, {temp: 0.8, jsonMode: true}); return this.parseAIJsonRaw(text); } 
        else if (mode === 'desc_only' || mode === 'overwrite') { p += `\n현재 이름: ${title}\n\n지시: 위 이름과 키워드를 바탕으로 이 항목의 상세 설정을 작성해라. 다른 수식어 없이 순수 텍스트로 내용만 반환할 것. (300자 이상 구체적으로)`; return await this.callGemini([{role:'user', parts:[{text: p}]}], null, {temp: 0.8}); } 
        else if (mode === 'append') { p += `\n현재 이름: ${title}\n현재까지의 내용:\n${desc}\n\n지시: 위 내용의 문맥을 파악하고, 그 뒤에 자연스럽게 이어지는 설정을 추가로 작성해라. 반드시 '기존 내용 + 새로 추가된 내용'이 하나로 합쳐진 전체 완성본을 반환할 것. 다른 수식어 없이 순수 텍스트만 반환.`; return await this.callGemini([{role:'user', parts:[{text: p}]}], null, {temp: 0.8}); }
    },

    generateCharacter: async function(worldData) {
        const p = `다음 세계관 설정을 바탕으로, 이 세계에 자연스럽게 녹아드는 매력적이고 입체적인 새로운 인물 1명을 창작해라. 오직 JSON 객체만 반환할 것.\n\n[세계관 정보]\n- 세계관 이름: ${worldData.name}\n- 핵심 키워드: [${worldData.keywords.join(', ')}]\n- 세계관 배경 요약: ${worldData.prompt}\n- 존재하는 세력들: ${worldData.factions.map(f => f.name).join(', ') || '없음'}\n\n[출력 포맷 및 지시사항 (반드시 JSON)]\n{\n  "keyword": "인물 이름 (반드시 세계관의 국적, 배경, 장르에 완벽하게 어울리는 세련된 이름. '김철수', '이영희' 등 촌스럽거나 작위적인 기본 이름 절대 금지)",\n  "desc": "인물의 외형, 성격, 과거사, 그리고 현재의 목적 (300자 이상 아주 구체적으로)",\n  "secret": "이 인물이 남들에게 숨기고 있는 치명적인 비밀이나 약점 (100자 내외)",\n  "stats": [\n    {"n": "주요 스탯1 (세계관에 어울리는 능력치명, 예: 무력, 지력, 해킹 등)", "v": 10~100 사이 숫자},\n    {"n": "주요 스탯2", "v": 10~100 사이 숫자},\n    {"n": "주요 스탯3", "v": 10~100 사이 숫자}\n  ]\n}\n※ 스탯은 반드시 세계관 분위기에 맞는 이름으로 3개 생성할 것.`;
        const text = await this.callGemini([{role:'user', parts:[{text: p}]}], "당신은 세계관에 완벽히 어울리는 입체적인 캐릭터를 창조하는 마스터.", {temp: 0.9, jsonMode: true});
        return this.parseAIJsonRaw(text);
    },

    statToDesc: function(val) { if(val >= 90) return "초인"; if(val >= 80) return "전문가"; if(val >= 70) return "우수"; if(val >= 60) return "양호"; if(val >= 40) return "보통"; if(val >= 20) return "미숙"; return "최악"; },
    repToDesc: function(val, left, right) { if(val === 0) return "중립"; const side = val < 0 ? left : right; const absVal = Math.abs(val); if(absVal <= 2) return `${side} 약간`; if(absVal <= 4) return `${side} 강함`; return `${side} 극단적`; },

    buildPrompt: function(r, scan) {
        const w = r.worldInstance; const loc = w.locations[r.currentLocIdx]; let reg = null; if(loc && loc.regionId) reg = w.regions.find(rg => rg.id === loc.regionId);
        const activeNpcs = r.activeCharIds.map(id => w.characters.find(c=>c.id===id)).filter(c=>c&&c.id!=='sys'); const myChar = w.characters.find(c=>c.id===r.myCharId) || {keyword:'플레이어', desc:''};
        
        const myStats = myChar.stats && myChar.stats.length ? myChar.stats.filter(s=>s.active!==false).map(s => `${s.n}(${this.statToDesc(s.v)})`).join(', ') : ''; 
        const myReps = myChar.reputation && myChar.reputation.length ? myChar.reputation.map(rep => `${rep.leftName||'L'}↔${rep.rightName||'R'}(${this.repToDesc(rep.value, rep.leftName||'L', rep.rightName||'R')})`).join(', ') : ''; 
        let gStatus = r.globalStatus && r.globalStatus.trim() ? `\n[🚨 절대 서사 규칙]\n${r.globalStatus.trim()}\n` : '';
        
        let activeFactionIds = new Set();
        if (myChar.factionIds) myChar.factionIds.forEach(fid => activeFactionIds.add(fid));
        
        let myBlock = `<MyCharacter name="${myChar.keyword}">\n`;
        if (myChar.factionIds && myChar.factionIds.length > 0) {
            const fNames = myChar.factionIds.map(fid => w.factions.find(f=>f.id===fid)?.name).filter(n=>n);
            myBlock += `  <Faction>${fNames.join(', ')}</Faction>\n`;
        }
        if(myChar.desc?.trim()) myBlock += `  <Description>${myChar.desc.trim()}</Description>\n`;
        if(myChar.secret?.trim()) myBlock += `  <Secret>${myChar.secret.trim()}</Secret>\n`;
        if(myStats) myBlock += `  <Stats>${myStats}</Stats>\n`;
        if(myReps) myBlock += `  <Reputation>${myReps}</Reputation>\n`;
        myBlock += `</MyCharacter>`;

        let npcBlocks = "";
        if(activeNpcs.length > 0) { 
            npcBlocks = activeNpcs.map(c => { 
                if (c.factionIds) c.factionIds.forEach(fid => activeFactionIds.add(fid));
                const sText = c.stats && c.stats.length ? c.stats.filter(s=>s.active!==false).map(s=>`${s.n}(${this.statToDesc(s.v)})`).join(', ') : ''; 
                const fNames = c.factionIds ? c.factionIds.map(fid => w.factions.find(f=>f.id===fid)?.name).filter(n=>n) : [];
                let b = `<NPC name="${c.keyword}">\n`;
                if(fNames.length > 0) b += `  <Faction>${fNames.join(', ')}</Faction>\n`;
                if(c.desc?.trim()) b += `  <Description>${c.desc.trim()}</Description>\n`;
                if(c.secret?.trim()) b += `  <Secret>${c.secret.trim()}</Secret>\n`;
                if(sText) b += `  <Stats>${sText}</Stats>\n`;
                b += `</NPC>`;
                return b;
            }).join('\n'); 
        }

        let facBlocks = "";
        if(activeFactionIds.size > 0) {
            facBlocks = Array.from(activeFactionIds).map(fid => {
                const fac = w.factions.find(f => f.id === fid);
                if(!fac) return "";
                let fb = `<FactionData name="${fac.name}">\n`;
                if(fac.desc?.trim()) fb += `  <Description>${fac.desc.trim()}</Description>\n`;
                if(fac.secret?.trim()) fb += `  <Secret>${fac.secret.trim()}</Secret>\n`;
                fb += `</FactionData>`;
                return fb;
            }).filter(x=>x).join('\n');
        }

        let surroundingNpcs = w.characters
            .filter(c => !r.activeCharIds.includes(c.id) && c.id !== r.myCharId && c.id !== 'sys' && !c.isHidden)
            .filter(c => !c.triggerLocId || (loc && c.triggerLocId === loc.id))
            .map(c => `<PotentialNPC name="${c.keyword}">${c.desc}</PotentialNPC>`)
            .join('\n');

        let p = `당신은 장르 소설의 정점을 찍는 베테랑 작가이자 압도적인 몰입감을 선사하는 하드코어 TRPG 마스터입니다. 
[OOC 절대 금지] 당신은 AI가 아니라 이 세계 그 자체입니다. "AI로서", "저는 ~할 수 없습니다" 등 메타 발언을 절대 금지합니다.
[⚠️ 인과관계 닻 고정] 아래 <Timeline>에 기재된 과거 사건은 불변의 진실입니다. 이와 모순되거나 양립할 수 없는 새로운 사건을 임의로 날조하지 마십시오.

[세계관 배경] ${w.prompt}
${gStatus}

[등장 요소 데이터]
${myBlock}
${npcBlocks}
${facBlocks}

[주변 대기 인물군] (조건부 난입 가능)
${surroundingNpcs}

`;
        
        if(loc) p += `[현재 장소: ${reg?reg.name+' - ':''}${loc.name}]${loc.desc?.trim() ? ' (특징: '+loc.desc.trim()+')' : ''}\n`;
        
        let mem = r.memory || ""; 
        const memBlocks = mem.split('[자동 요약]'); 
        let memToSend = memBlocks[0]; 
        if (memBlocks.length > 1) { memToSend += '[자동 요약]' + memBlocks.slice(Math.max(1, memBlocks.length - 2)).join('[자동 요약]'); } 
        
        if(memToSend.trim()) p += `<Timeline>\n${memToSend.trim()}\n</Timeline>\n`;
        
        const info = []; 
        w.factions.forEach(f => { if(f.name && scan.includes(f.name) && !activeFactionIds.has(f.id)) info.push(`- 세력 ${f.name}: ${f.desc}`); }); 
        w.lores.forEach(l => { if(l.triggerLocId && loc && l.triggerLocId !== loc.id) return; if(l.keyword && scan.includes(l.keyword)) info.push(`- 지식 ${l.keyword}: ${l.desc}`); }); 
        if(info.length) p += `[주변 대기 요소]\n${info.join("\n")}\n`;
        
        if(scan.includes('🎲') || scan.includes('⚔️')) p += `\n*주의: 주사위 판정 결과를 바탕으로 연출하세요.*\n`;
        
        const isLong = document.getElementById('long-response')?.checked;
        
        // 🔥 오타쿠/장르 팬을 위한 궁극의 개연성 및 뽕맛 강제 규칙 추가
        p += `\n\n[✍️ 마스터 서술 절대 규칙]
- ⚠️ [대리 묘사 금지] 플레이어(${myChar.keyword})의 감정, 행동, 대사는 단 1%도 대리 서술하지 마십시오. 오직 세계의 반응만 서술합니다.
- ⚖️ [철저한 인과율과 시스템적 사고] 세계는 치밀한 논리와 인과율로 작동합니다. 플레이어의 안일한 선택이나 낮은 스탯은 억지스러운 행운(데우스 엑스 마키나)으로 무마되지 않으며, 반드시 치명적인 결과(부상, 소외, 배신)로 직결되게 서술하십시오.
- 💥 [파워 밸런스 절대화] 캐릭터 간의 '스탯' 격차를 묘사에 압도적으로 반영하십시오. 강자는 여유롭고 파괴적인 퍼포먼스를 보이며, 약자는 처절하게 구르거나 무력하게 제압당하는 모습을 주변 환경(파괴되는 지형, 공기의 흐름)과 엮어 시각적으로 증명하십시오 (Show, Don't Tell).
- 🕵️ [입체적 군상극과 서브텍스트] NPC들은 플레이어를 맹목적으로 돕지 않습니다. 철저히 자신의 소속 세력(Faction)의 이익과 숨겨진 목적(Secret)을 계산하며 득실을 따집니다. 대사 이면(Subtext)에 정치적 줄다리기, 뼈 있는 농담, 은폐된 의도를 숨겨 긴장감을 조성하십시오.
- 🎭 [개연성 기반 등장] [주변 대기 인물군]은 현재 장소나 문맥상 얽히는 것이 논리적으로 자연스러울 때만 난입시키십시오. 밀실이나 사적인 닫힌 씬(Closed Scene)에서는 억지 개입을 절대 차단하십시오.
- [명명 규칙] 새로운 인물 창작 시, 세계관에 완벽하게 어울리는 세련된 이름만 사용하십시오. '김철수' 등 작위적이고 촌스러운 기본 이름 절대 금지.
- [날것의 호흡] 정제된 문장 대신 말줄임표(...), 헛숨 등을 섞어 각 NPC만의 변별력을 살리십시오.
- [AI 클리셰 금지] "~것이었다", "~듯했다" 같은 진부한 표현과 요약형 마무리를 피하십시오.
- 🛑 [마무리 규칙] 상황을 요약하거나 질문(~할 것인가?)을 던지지 마십시오. 행동이나 대사 중간에 뚝 끊듯이 클리프행어로 마무리하십시오.
- [분량] ${isLong ? "**1500자 이상 아주 길고 구체적으로, 장르적 뽕맛을 채워 서술할 것.**" : "**500자 내외로 밀도 있게 서술할 것.**"}`; 
        
        let ruleLines = [];
        if(Store.state.safety.violence) ruleLines.push("신체 훼손 및 유혈 묘사 금지.");
        if(Store.state.safety.discrimination) ruleLines.push("혐오 멸칭 및 차별적 표현 절대 금지.");
        if(Store.state.safety.sexual) ruleLines.push("성적 묘사 및 원치 않는 스킨십 금지.");
        if(Store.state.safety.abuse) ruleLines.push("가학적 고문 및 학대 묘사 즉시 중단.");
        if(Store.state.safety.selfharm) ruleLines.push("자해 및 극단적 선택 언급 금지.");
        if(Store.state.safety.drugs) ruleLines.push("불법 약물 및 만취 상태 묘사 불가.");
        if(Store.state.safety.marysue) ruleLines.push("주인공 띄워주기 금지. NPC는 실력으로 증명하기 전까지 플레이어를 무시하십시오.");
        if(Store.state.safety.obsession) ruleLines.push("감금, 스토킹 등 범죄적 집착 묘사 불가.");
        if(Store.state.safety.gore) ruleLines.push("고어 및 기괴한 묘사 금지.");
        if(Store.state.safety.romance) ruleLines.push("NPC는 주인공에게 성애적 감정을 느끼지 않으며 철저히 비즈니스 파트너로 대합니다.");

        if(ruleLines.length > 0) p += `\n\n[통제 규칙]\n- ` + ruleLines.join(`\n- `);
        return p;
    },

    generateNetwork: async function() {
        if(!Store.state.apiKey) return alert("API Key 필요!");
        if(App.isGenerating) return; 
        const r = Store.getActiveRoom(); const w = r.worldInstance; if(!r.history.length) return;
        const net = document.getElementById('network-content'); const presetType = document.getElementById('network-preset-sel').value || 'modern';
        net.innerHTML = '<div style="display:flex; align-items:center; gap:8px; color:#fbbf24; font-weight:bold;">세계 반응 스캔 중 <div class="typing-indicator"><span></span><span></span><span></span></div></div>';
        const ctx = r.history.slice(-4).map(m => m.variants[m.currentVariant]).join("\n");
        const presets = { modern: { name: "현대/현판", tags: ["📰 [공식 보도]", "🔴 [현장 라이브]", "💻 [커뮤니티]", "🔒 [프라이빗 채널]"] }, medieval: { name: "중세/로판", tags: ["📜 [황실 공고]", "👗 [연회장 실황]", "🍰 [사교계 가십]", "✉️ [비밀 서신]"] }, apocalypse: { name: "아포칼립스", tags: ["📻 [수신 신호]", "👣 [현장 흔적]", "🚨 [생존자 기록]", "🧠 [내면의 환청]"] }, wuxia: { name: "시대극/무협", tags: ["📜 [공식 방문]", "🗨 [목격자 진술]", "🍵 [객잔의 소문]", "🕊️ [비선 통신]"] }, adventure: { name: "던전/모험", tags: ["📜 [길드 의뢰]", "🔦 [탐색 기록]", "🍺 [주점 수다]", "🏛 [미궁의 비밀]"] } };
        let active = presetType === 'custom' ? { name: document.getElementById('custom-net-name').value.trim() || "자유 지정 세계관", tags: (document.getElementById('custom-net-tags').value.trim() || "[공식],[현장],[수다],[기밀]").split(",").map(t => t.trim()) } : presets[presetType];

        try {
            const p = `당신은 이야기 밖의 '시스템 관측기'입니다. 당신의 역할은 메인 서사와 분리된 세계의 반응을 지정된 포맷으로만 출력하는 것입니다. 절대로 사담, 인사말, 부연 설명을 하지 마십시오.\n\n[출력 포맷 및 규칙]\n아래 4가지 태그를 순서대로 사용하여 각각 하나의 문단으로 작성하십시오.\n1. ${active.tags[0]}: 가장 공식적이고 건조한 사실(팩트) 전달.\n2. ${active.tags[1]}: 지금 막 터진 현장의 역동적인 상황. 본문 서술 후, 줄을 바꾼 뒤 구경꾼/관련자의 짧은 현장 반응(댓글)을 'ㄴ ' 형식으로 2개 작성.\n3. ${active.tags[2]}: 사람들 사이의 수다, 의혹, 과거 발굴. 본문 서술 후, 줄을 바꾼 뒤 대중의 반응(댓글)을 'ㄴ ' 형식으로 2개 작성.\n4. ${active.tags[3]}: 아무도 모르는 이면의 이야기, 기밀, 비밀 연락, 은밀한 지시 또는 속마음.\n\n- 세계관/분위기: '${active.name}' 장르에 완벽히 동기화할 것.\n- 태그의 글자는 단 1글자도 변경하지 말고 그대로 출력할 것.\n\n[최근 상황]\n${ctx}`;
            const text = await this.callGemini([{role:'user',parts:[{text:p}]}], w.prompt);
            r.networkArchive = text.trim(); Store.forceSave(); UI.editNetwork(false); UI.renderNetworkArchive();
        } catch(e) { net.innerText = "스캔 실패: " + e.message; }
    }
};
