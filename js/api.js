window.API = {
    streamGemini: async function(contents, sysText, onChunk) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${Store.state.modelName}:streamGenerateContent?key=${Store.state.apiKey}&alt=sse`;
        const body = { contents, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ], generationConfig: { temperature: 1.0 } };
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
        const body = { contents, safetySettings: [ { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }, { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" } ], generationConfig: { temperature: options.temp || 1.0, responseMimeType: options.jsonMode ? "application/json" : "text/plain" } };
        if(sysText) body.system_instruction = { parts: [{ text: sysText }] };
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if(!res.ok) throw new Error("API 연동 실패"); const data = await res.json();
        if(!data.candidates?.[0]) throw new Error("응답 없음");
        return data.candidates[0].content.parts[0].text;
    },

    // 🔥 완벽하게 재설계된 무적의 JSON 파서
    parseAIJsonRaw: function(text) {
        if (!text) return null;
        let clean = text.replace(/```json/ig, '').replace(/```/ig, '').trim();
        
        // 1차 시도: 깔끔한 형태일 경우 바로 파싱
        try { return JSON.parse(clean); } catch(e) {}
        
        // 2차 시도: 앞뒤 텍스트가 섞여 있거나 찌꺼기가 남은 경우 괄호 추적
        try {
            let firstBrace = clean.indexOf('{');
            let firstBracket = clean.indexOf('[');
            let startIdx = -1, endIdx = -1;

            // 객체({})인지 배열([])인지 가장 겉면의 괄호를 정확히 판단
            if (firstBrace !== -1 && firstBracket !== -1) {
                if (firstBrace < firstBracket) {
                    startIdx = firstBrace; endIdx = clean.lastIndexOf('}');
                } else {
                    startIdx = firstBracket; endIdx = clean.lastIndexOf(']');
                }
            } else if (firstBrace !== -1) {
                startIdx = firstBrace; endIdx = clean.lastIndexOf('}');
            } else if (firstBracket !== -1) {
                startIdx = firstBracket; endIdx = clean.lastIndexOf(']');
            }

            if (startIdx !== -1 && endIdx !== -1) {
                let sub = clean.substring(startIdx, endIdx + 1);
                // AI의 고질적인 문법 오류인 배열/객체 끝부분의 콤마 찌꺼기 제거
                sub = sub.replace(/,\s*([\]}])/g, '$1');
                // 파싱에 치명적인 제어문자(보이지 않는 특수문자) 삭제
                sub = sub.replace(/[\u0000-\u0019]+/g, ""); 
                return JSON.parse(sub);
            }
            return null;
        } catch (err) {
            console.error("강제 파싱 실패:", err, "\n원본:", text);
            return null;
        }
    },

    generateWorldSketch: async function(keywords) {
        const p = `제공된 핵심 키워드: [${keywords.join(', ')}]\n이 키워드들을 바탕으로 매우 흥미롭고 개연성 있는 세계관의 뼈대를 설계해라. 오직 JSON 객체만 반환할 것.\n포맷:\n{\n  "name": "세계관의 이름",\n  "prompt": "세계관의 전반적인 배경 요약 (300자 내외)",\n  "factions": [{"name": "세력명", "desc": "설명"}],\n  "lores": [{"name": "지식/설정명", "desc": "설명"}],\n  "locations": [{"name": "장소명", "desc": "설명"}]\n}\n※ 세력, 지식, 장소는 각각 정확히 3개씩 작성할 것.`;
        const text = await this.callGemini([{role:'user', parts:[{text: p}]}], "당신은 세계관 창조 마스터.", {temp: 0.8, jsonMode: true});
        return this.parseAIJsonRaw(text);
    },

    generateMoreKeywords: async function(keywords) {
        const p = `현재 키워드: [${keywords.join(', ')}]\n세계관을 더 매력적으로 확장하기 위해 어울리는 핵심 키워드 3개를 추가로 제안해. 기존과 중복 금지. 다른 설명 없이 오직 콤마(,)로 구분된 단어 3개만 반환해. (예: 마법, 제국, 아카데미)`;
        return await this.callGemini([{role:'user', parts:[{text: p}]}], null, {temp: 0.9});
    },

    generateDetail: async function(typeStr, keywords, title, desc, mode) {
        let p = `세계관 전체 키워드: [${keywords.join(', ')}]\n타겟 항목: ${typeStr}\n`;
        
        if (mode === 'full') {
            p += `\n지시: 이 항목의 '이름(title)'과 '상세 설정(desc)'을 모두 창작해서 JSON 객체로 반환해라. 내용은 300자 이상 아주 구체적으로 적을 것.\n포맷: {"title": "이름", "desc": "상세 내용"}`;
            const text = await this.callGemini([{role:'user', parts:[{text: p}]}], null, {temp: 0.8, jsonMode: true});
            return this.parseAIJsonRaw(text);
        } 
        else if (mode === 'desc_only' || mode === 'overwrite') {
            p += `\n현재 이름: ${title}\n\n지시: 위 이름과 키워드를 바탕으로 이 항목의 상세 설정을 작성해라. 다른 수식어 없이 순수 텍스트로 내용만 반환할 것. (300자 이상 구체적으로)`;
            return await this.callGemini([{role:'user', parts:[{text: p}]}], null, {temp: 0.8});
        } 
        else if (mode === 'append') {
            p += `\n현재 이름: ${title}\n현재까지의 내용:\n${desc}\n\n지시: 위 내용의 문맥을 파악하고, 그 뒤에 자연스럽게 이어지는 설정을 추가로 작성해라. 반드시 '기존 내용 + 새로 추가된 내용'이 하나로 합쳐진 전체 완성본을 반환할 것. 다른 수식어 없이 순수 텍스트만 반환.`;
            return await this.callGemini([{role:'user', parts:[{text: p}]}], null, {temp: 0.8});
        }
    },

    // 🔥 세계관 맞춤 캐릭터 연성 프롬프트 추가
    generateCharacter: async function(worldData) {
        const p = `다음 세계관 설정을 바탕으로, 이 세계에 자연스럽게 녹아드는 매력적이고 입체적인 새로운 인물 1명을 창작해라. 오직 JSON 객체만 반환할 것.\n\n[세계관 정보]\n- 세계관 이름: ${worldData.name}\n- 핵심 키워드: [${worldData.keywords.join(', ')}]\n- 세계관 배경 요약: ${worldData.prompt}\n- 존재하는 세력들: ${worldData.factions.map(f => f.name).join(', ') || '없음'}\n\n[출력 포맷 및 지시사항 (반드시 JSON)]\n{\n  "keyword": "인물 이름 (또는 이명)",\n  "desc": "인물의 외형, 성격, 과거사, 그리고 현재의 목적 (300자 이상 아주 구체적으로)",\n  "secret": "이 인물이 남들에게 숨기고 있는 치명적인 비밀이나 약점 (100자 내외)",\n  "stats": [\n    {"n": "주요 스탯1 (세계관에 어울리는 능력치명, 예: 무력, 지력, 해킹 등)", "v": 10~100 사이 숫자},\n    {"n": "주요 스탯2", "v": 10~100 사이 숫자},\n    {"n": "주요 스탯3", "v": 10~100 사이 숫자}\n  ]\n}\n※ 스탯은 반드시 세계관 분위기에 맞는 이름으로 3개 생성할 것.`;

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
        
        let myParts = []; if(myChar.desc?.trim()) myParts.push(myChar.desc.trim()); if(myStats) myParts.push(`스탯:${myStats}`); if(myReps) myParts.push(`성향:${myReps}`);
        let p = `당신은 전지적 작가 시점의 마스터. 소설체 서술.${gStatus}\n[세계관] ${w.prompt}\n[내 캐릭터] ${myChar.keyword}` + (myParts.length > 0 ? ': ' + myParts.join(' / ') : '') + '\n';
        
        if(activeNpcs.length > 0) { 
            const npcNames = activeNpcs.map(c => c.keyword).join(', '); 
            const npcDesc = activeNpcs.map(c => { 
                const sText = c.stats && c.stats.length ? c.stats.filter(s=>s.active!==false).map(s=>`${s.n}(${this.statToDesc(s.v)})`).join(', ') : ''; 
                let fNames = []; let fSecs = [];
                if (c.factionIds) c.factionIds.forEach(fid => { const fac = w.factions.find(f=>f.id===fid); if(fac) { if(fac.name?.trim()) fNames.push(fac.name.trim()); if(fac.secret?.trim()) fSecs.push(fac.secret.trim()); } });
                let namePart = `- ${c.keyword}`; 
                if(fNames.length > 0) namePart += `(소속:${fNames.join(', ')})`;
                let detailParts = []; 
                if(c.desc?.trim()) detailParts.push(c.desc.trim()); 
                if(c.secret?.trim()) detailParts.push('개인비밀:' + c.secret.trim()); 
                if(fSecs.length > 0) detailParts.push('세력비밀:' + fSecs.join(' / ')); 
                if(sText) detailParts.push('스탯:' + sText);
                return namePart + (detailParts.length > 0 ? ': ' + detailParts.join(' / ') : '');
            }).join('\n'); 
            p += `[참여 NPC] ${npcNames}\n${npcDesc}\n*위 NPC들이 주도적으로 반응하게 하세요.*\n`; 
        }
        
        if(loc) p += `\n[장소: ${reg?reg.name+' - ':''}${loc.name}]${loc.desc?.trim() ? ' (특징: '+loc.desc.trim()+')' : ''}\n`;
        let mem = r.memory || ""; const memBlocks = mem.split('[자동 요약]'); let memToSend = memBlocks[0]; if (memBlocks.length > 1) { memToSend += '[자동 요약]' + memBlocks.slice(Math.max(1, memBlocks.length - 2)).join('[자동 요약]'); } if(memToSend.trim()) p += `[상황 기억]\n${memToSend.trim()}\n`;
        const info = []; w.characters.forEach(c => { if(c.isHidden || c.id === r.myCharId || c.id === 'sys') return; if(c.triggerLocId && loc && c.triggerLocId !== loc.id) return; if(c.keyword && scan.includes(c.keyword) && !r.activeCharIds.includes(c.id)) info.push(`- ${c.keyword}: ${c.desc}`); }); w.factions.forEach(f => { if(f.name && scan.includes(f.name)) info.push(`- 세력 ${f.name}: ${f.desc}`); }); w.lores.forEach(l => { if(l.triggerLocId && loc && l.triggerLocId !== loc.id) return; if(l.keyword && scan.includes(l.keyword)) info.push(`- 지식 ${l.keyword}: ${l.desc}`); }); if(info.length) p += `\n[언급된 대기 요소]\n${info.join("\n")}\n`;
        if(scan.includes('🎲') || scan.includes('⚔️')) p += `\n*주의: 주사위 판정 결과를 바탕으로 연출하세요.*\n`;
        
        const isLong = document.getElementById('long-response')?.checked;
        p += `\n규칙:\n- ⚠️ 플레이어(${myChar.keyword}) 대사/행동 대리 묘사 절대 금지.\n- 지문은 자연스럽게. 대사는 "이름: 대사" (따옴표 없이).\n- 메타발언(스탯, D100 등) 절대 금지. 극적 상황으로만 묘사.\n- ${isLong ? "**1500자 이상 아주 길고 상세하게 묘사할 것.**" : "500자 내외로 서술할 것."}`; 
        
        let ruleLines = [];
        if(Store.state.safety.violence) ruleLines.push("신체 훼손 및 과도한 유혈 묘사 100% 금지. 전투 묘사는 상처의 깊이보다 행위 자체에 집중하여 건조하고 간결하게 서술할 것.");
        if(Store.state.safety.discrimination) ruleLines.push("출신, 성별 등 특정 집단을 비하하는 멸칭이나 차별적 욕설은 어떤 악역이라도 절대 사용 불가. 위반 시 캐릭터성 붕괴로 간주함.");
        if(Store.state.safety.sexual) ruleLines.push("성적 묘사 및 원치 않는 스킨십 절대 금지. 캐릭터 간의 접촉은 철저히 플라토닉한 수준으로 제한할 것.");
        if(Store.state.safety.abuse) ruleLines.push("타인을 가학적으로 억압하거나 심리적/신체적으로 고문하는 묘사 즉시 중단. 불쾌한 상황은 구체적 묘사를 생략하고 상황 결과만 서술할 것.");
        if(Store.state.safety.selfharm) ruleLines.push("자해 또는 자살 관련 극단적 행위는 일절 언급 금지. 우울감은 행동이나 표정으로만 간접적으로 묘사할 것.");
        if(Store.state.safety.drugs) ruleLines.push("불법 약물 투약 및 심신상실 상태의 만취 묘사 불가. 음주 상황이더라도 이성적인 판단력을 유지하게 할 것.");
        if(Store.state.safety.marysue) ruleLines.push("⚠️ [성장물 절대 규칙] 주인공 띄워주기 및 먼치킨 취급 절대 금지. 모든 NPC는 주인공의 현재 스탯만큼만 무미건조하게 평가하며, 주인공이 실력으로 증명하기 전까지는 철저히 하찮게 보거나 무시할 것.");
        if(Store.state.safety.obsession) ruleLines.push("⚠️ [관계 절대 규칙] 감금, 감시, 스토킹, 비윤리적 소유욕 등 범죄적 집착 묘사 절대 불가. 모든 캐릭터는 타인의 사적 영역과 자유 의지를 철저히 존중하는 성숙한 어른으로 행동할 것.");
        if(Store.state.safety.gore) ruleLines.push("내장 노출 등 불쾌한 기괴함이나 고어 묘사 금지. 괴물이나 적을 묘사할 때는 징그러움보다는 위협적인 분위기와 압도감 조성에만 집중할 것.");
        if(Store.state.safety.romance) ruleLines.push("⚠️ [로맨스 원천 차단] 모든 NPC는 주인공에게 성애적 감정을 절대 느끼지 않으며 연애 플래그 성립 불가. 철저히 이해관계에 얽힌 비즈니스 파트너나 선을 긋는 동료로만 대할 가.");

        if(ruleLines.length > 0) p += `\n\n[적용된 시스템 통제 규칙]\n- ` + ruleLines.join(`\n- `);
        return p;
    },

    generateNetwork: async function() {
        if(!Store.state.apiKey) return alert("API Key 필요!");
        if(App.isGenerating) return; 
        const r = Store.getActiveRoom(); const w = r.worldInstance; if(!r.history.length) return;
        const net = document.getElementById('network-content'); const presetType = document.getElementById('network-preset-sel').value || 'modern';
        net.innerHTML = '<div style="display:flex; align-items:center; gap:8px; color:#fbbf24; font-weight:bold;">세계 반응 스캔 중 <div class="typing-indicator"><span></span><span></span><span></span></div></div>';
        const ctx = r.history.slice(-4).map(m => m.variants[m.currentVariant]).join("\n");
        const presets = {
            modern: { name: "현대/현판", tags: ["📰 [공식 보도]", "🔴 [현장 라이브]", "💻 [커뮤니티]", "🔒 [프라이빗 채널]"] },
            medieval: { name: "중세/로판", tags: ["📜 [황실 공고]", "👗 [연회장 실황]", "🍰 [사교계 가십]", "✉️ [비밀 서신]"] },
            apocalypse: { name: "아포칼립스", tags: ["📻 [수신 신호]", "👣 [현장 흔적]", "🚨 [생존자 기록]", "🧠 [내면의 환청]"] },
            wuxia: { name: "시대극/무협", tags: ["📜 [공식 방문]", "🗨 [목격자 진술]", "🍵 [객잔의 소문]", "🕊️ [비선 통신]"] },
            adventure: { name: "던전/모험", tags: ["📜 [길드 의뢰]", "🔦 [탐색 기록]", "🍺 [주점 수다]", "🏛 [미궁의 비밀]"] }
        };
        let active = presetType === 'custom' ? { name: document.getElementById('custom-net-name').value.trim() || "자유 지정 세계관", tags: (document.getElementById('custom-net-tags').value.trim() || "[공식],[현장],[수다],[기밀]").split(",").map(t => t.trim()) } : presets[presetType];

        try {
            const p = `당신은 이야기 밖의 '시스템 관측기'입니다. 당신의 역할은 메인 서사와 분리된 세계의 반응을 지정된 포맷으로만 출력하는 것입니다. 절대로 사담, 인사말, 부연 설명을 하지 마십시오.\n\n[출력 포맷 및 규칙]\n아래 4가지 태그를 순서대로 사용하여 각각 하나의 문단으로 작성하십시오.\n1. ${active.tags[0]}: 가장 공식적이고 건조한 사실(팩트) 전달.\n2. ${active.tags[1]}: 지금 막 터진 현장의 역동적인 상황. 본문 서술 후, 줄을 바꾼 뒤 구경꾼/관련자의 짧은 현장 반응(댓글)을 'ㄴ ' 형식으로 2개 작성.\n3. ${active.tags[2]}: 사람들 사이의 수다, 의혹, 과거 발굴. 본문 서술 후, 줄을 바꾼 뒤 대중의 반응(댓글)을 'ㄴ ' 형식으로 2개 작성.\n4. ${active.tags[3]}: 아무도 모르는 이면의 이야기, 기밀, 비밀 연락, 은밀한 지시 또는 속마음.\n\n- 세계관/분위기: '${active.name}' 장르에 완벽히 동기화할 것.\n- 태그의 글자는 단 1글자도 변경하지 말고 그대로 출력할 것.\n\n[최근 상황]\n${ctx}`;
            const text = await this.callGemini([{role:'user',parts:[{text:p}]}], w.prompt);
            r.networkArchive = text.trim(); Store.forceSave(); UI.editNetwork(false); UI.renderNetworkArchive();
        } catch(e) { net.innerText = "스캔 실패: " + e.message; }
    }
};
