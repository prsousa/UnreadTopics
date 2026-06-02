/**
 * quickQuote.js
 * 
 * Módulo responsável pela funcionalidade de "Citação Rápida".
 * Permite selecionar texto numa publicação do fórum e cita-lo
 * instantaneamente no editor através de um balão flutuante contextual.
 * 
 * Suporta injeção direta no editor ativo, previsualização automática (Preview),
 * citação a partir do sumário do tópico (Topic Summary) no editor de resposta,
 * e redirecionamento dinâmico caso o utilizador esteja a ler o fórum normalmente.
 */

"use strict";

(function () {
    
    // Configurações do balão flutuante
    const BUBBLE_ID = "quick-quote-bubble";
    const BUBBLE_SPACING = 8; // Espaço em pixéis acima da seleção
    
    let currentBubble = null;
    let selectedText = "";
    let postAuthor = "";
    let postMsgId = ""; // Guardará o ID da mensagem para criar a hiperligação original
    let postDate = ""; // Guardará o timestamp do post original
    let currentRange = null; // Guardará o Range da seleção ativa
    let currentParentPost = null; // Guardará o $parentPost ativo

    // Inicialização do módulo quando a página estiver pronta
    $(document).ready(function () {
        setupSelectionListeners();
        checkPendingQuotes();
    });

    /**
     * Configura os ouvintes de eventos para capturar as seleções do utilizador.
     */
    function setupSelectionListeners() {
        // Escuta quando o utilizador larga o clique do rato
        document.addEventListener("mouseup", handleMouseUp);

        // Remove o balão se o utilizador clicar noutro sítio ou se a seleção for limpa
        document.addEventListener("mousedown", function (e) {
            if (currentBubble && !currentBubble.contains(e.target)) {
                removeBubble();
            }
        });
    }

    /**
     * Verifica se existe alguma citação pendente em sessionStorage (de um redirecionamento anterior)
     * e insere-a automaticamente no editor com previsualização automática.
     */
    function checkPendingQuotes() {
        const pendingQuote = sessionStorage.getItem("pending_quote");
        if (!pendingQuote) return;

        // Procura a caixa de texto do editor principal
        const $textarea = $("textarea#message, .quickReplyContent > textarea");
        if ($textarea.length > 0) {
            const textareaEl = $textarea[0];
            
            // Define o conteúdo do editor com a citação pendente
            $textarea.val(pendingQuote);
            
            // Limpa o sessionStorage imediatamente para não repetir o comportamento
            sessionStorage.removeItem("pending_quote");

            // Foca no editor de texto e coloca o cursor no fim do texto inserido
            $textarea.focus();
            const textLength = pendingQuote.length;
            textareaEl.setSelectionRange(textLength, textLength);
        }
    }

    /**
     * Trata o evento de mouseup para detetar se há texto selecionado.
     */
    function handleMouseUp(e) {
        // Aguarda um pequeno instante para que a seleção do browser seja concluída
        setTimeout(() => {
            const selection = window.getSelection();
            selectedText = selection.toString().trim();

            // Se não houver texto selecionado, remove o balão caso ele exista
            if (!selectedText) {
                removeBubble();
                return;
            }

            // Verifica se a seleção ocorreu dentro de um post do fórum ou do sumário de tópicos
            const anchorNode = selection.anchorNode;
            if (!anchorNode) return;

            // Garante que a seleção ocorreu estritamente dentro do texto de um post (.post ou .inner)
            // ou dentro do Sumário de Tópicos no fundo da página de escrita (#topic_summary_area ou #topic_summary)
            let $parentPost = $(anchorNode).closest(".post, .inner");
            if ($parentPost.length === 0) {
                // Caso não esteja em .post ou .inner, verifica se está na tabela do sumário de tópicos
                const $inSummary = $(anchorNode).closest("#topic_summary_area, #topic_summary");
                if ($inSummary.length > 0) {
                    // No sumário de tópicos, o texto da publicação fica dentro das linhas tr ou células td
                    $parentPost = $(anchorNode).closest("tr");
                }
            }

            if ($parentPost.length === 0) {
                removeBubble();
                return;
            }

            // Descobre os detalhes do post de forma inteligente (autor, ID da mensagem e data)
            const postDetails = extractPostDetails($parentPost);
            postAuthor = postDetails.author;
            postMsgId = postDetails.msgId;
            postDate = postDetails.date;

            // Encontra todos os blockquotes pais entre o nó selecionado e o post principal
            currentRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            currentParentPost = $parentPost;

            // Posiciona e exibe o balão flutuante
            showBubble(selection);
        }, 10);
    }

    /**
     * Converte o texto da data em português ou inglês do SMF para um timestamp UNIX compatível.
     * Suporta formatos com ou sem segundos (HH:MM e HH:MM:SS), meses abreviados e separadores dinâmicos.
     */
    function parseSMFDate(dateText) {
        if (!dateText) return "";

        // Remove caracteres de formatação e limpa o texto
        // Ex: "« em: Junho 02, 2026, 00:17:19 »" -> "Junho 02, 2026, 00:17:19"
        let cleanText = dateText.replace(/[«»]/g, "").replace(/\b(em|on):?/gi, "").trim();
        const now = new Date();

        // Caso A: "Hoje às 00:17" ou "Today at 10:37"
        if (cleanText.toLowerCase().includes("hoje") || cleanText.toLowerCase().includes("today")) {
            const timeMatch = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(cleanText);
            if (timeMatch) {
                const seg = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
                now.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), seg, 0);
                return Math.floor(now.getTime() / 1000).toString();
            }
        }

        // Caso B: "Ontem às 23:15" ou "Yesterday at 10:37"
        if (cleanText.toLowerCase().includes("ontem") || cleanText.toLowerCase().includes("yesterday")) {
            const timeMatch = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(cleanText);
            if (timeMatch) {
                const seg = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
                const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                yesterday.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), seg, 0);
                return Math.floor(yesterday.getTime() / 1000).toString();
            }
        }

        // Mapeamento dos meses em português e inglês (incluindo abreviações comuns de 3 ou 4 letras)
        const meses = {
            "janeiro": 0, "jan": 0, "january": 0,
            "fevereiro": 1, "fev": 1, "february": 1, "feb": 1,
            "março": 2, "marco": 2, "mar": 2, "march": 2,
            "abril": 3, "abr": 3, "april": 3, "apr": 3,
            "maio": 4, "mai": 4, "may": 4,
            "junho": 5, "jun": 5, "june": 5,
            "julho": 6, "jul": 6, "july": 6,
            "agosto": 7, "ago": 7, "august": 7, "aug": 7,
            "setembro": 8, "set": 8, "september": 8, "sep": 8,
            "outubro": 9, "out": 9, "october": 9, "oct": 9,
            "novembro": 10, "nov": 10, "november": 10,
            "dezembro": 11, "dez": 11, "december": 11, "dec": 11
        };

        // Caso C: "2 de Junho de 2026, 00:17" ou "2 de Junho de 2026 às 00:17:19"
        // Suporta separadores flexíveis como espaços, vírgulas, "às" ou "at"
        const matchPT1 = /(\d{1,2})\s+de\s+(\S+)\s+de\s+(\d{4}).*?(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(cleanText);
        if (matchPT1) {
            const dia = parseInt(matchPT1[1]);
            const mesText = matchPT1[2].toLowerCase();
            const ano = parseInt(matchPT1[3]);
            const hora = parseInt(matchPT1[4]);
            const min = parseInt(matchPT1[5]);
            const seg = matchPT1[6] ? parseInt(matchPT1[6]) : 0;

            const mesIndex = meses[mesText] !== undefined ? meses[mesText] : now.getMonth();
            const parsedDate = new Date(ano, mesIndex, dia, hora, min, seg);
            return Math.floor(parsedDate.getTime() / 1000).toString();
        }

        // Caso F: "20 May 2026, 20:44:43" (Formato de data em inglês standard do SMF)
        const matchPT3 = /(\d{1,2})\s+(\S+)\s+(\d{4}).*?(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(cleanText);
        if (matchPT3) {
            const dia = parseInt(matchPT3[1]);
            const mesText = matchPT3[2].toLowerCase();
            const ano = parseInt(matchPT3[3]);
            const hora = parseInt(matchPT3[4]);
            const min = parseInt(matchPT3[5]);
            const seg = matchPT3[6] ? parseInt(matchPT3[6]) : 0;

            const mesIndex = meses[mesText] !== undefined ? meses[mesText] : now.getMonth();
            const parsedDate = new Date(ano, mesIndex, dia, hora, min, seg);
            return Math.floor(parsedDate.getTime() / 1000).toString();
        }

        // Caso D: "Junho 02, 2026, 00:17" ou "Junho 02, 2026 às 00:17:19"
        const matchPT2 = /(\S+)\s+(\d{1,2}),\s+(\d{4}).*?(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(cleanText);
        if (matchPT2) {
            const mesText = matchPT2[1].toLowerCase();
            const dia = parseInt(matchPT2[2]);
            const ano = parseInt(matchPT2[3]);
            const hora = parseInt(matchPT2[4]);
            const min = parseInt(matchPT2[5]);
            const seg = matchPT2[6] ? parseInt(matchPT2[6]) : 0;

            const mesIndex = meses[mesText] !== undefined ? meses[mesText] : now.getMonth();
            const parsedDate = new Date(ano, mesIndex, dia, hora, min, seg);
            return Math.floor(parsedDate.getTime() / 1000).toString();
        }

        // Caso E: "02/06/2026 00:17" ou "02-06-2026 00:17:19"
        const matchNumeric = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}).*?(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(cleanText);
        if (matchNumeric) {
            const dia = parseInt(matchNumeric[1]);
            const mesIndex = parseInt(matchNumeric[2]) - 1;
            const ano = parseInt(matchNumeric[3]);
            const hora = parseInt(matchNumeric[4]);
            const min = parseInt(matchNumeric[5]);
            const seg = matchNumeric[6] ? parseInt(matchNumeric[6]) : 0;

            const parsedDate = new Date(ano, mesIndex, dia, hora, min, seg);
            return Math.floor(parsedDate.getTime() / 1000).toString();
        }

        // Se falhar a conversão de formato, retorna vazio para que o BBCode não use uma data falsa
        console.warn("[QuickQuote] Não foi possível converter o formato da data:", cleanText);
        return "";
    }

    const monthRegex = /(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|january|february|march|april|may|june|july|august|september|october|november|december|feb|apr|jun|jul|aug|sep|oct|nov|dec)/i;

    /**
     * Auxiliar para verificar se um determinado texto é uma data legível por humanos.
     */
    function isDateText(text) {
        if (!/\b\d{1,2}:\d{2}/.test(text)) return false;
        return monthRegex.test(text) || 
               /\b(20|19)\d{2}\b/.test(text) || 
               /(hoje|ontem|today|yesterday)/i.test(text) || 
               /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/.test(text);
    }

    /**
     * Procura o nome do autor da publicação e o ID da mensagem com base na estrutura do SMF 2.0.19.
     * Suporta a página de leitura normal de tópicos e o Sumário de Tópicos no fundo do editor.
     */
    function extractPostDetails($postElement) {
        // Encontra o bloco principal da publicação
        const $wrapper = $postElement.closest(".post_wrapper, .windowbg, .windowbg2, #topic_summary_area tr, tr[id^='msg_']");
        if ($wrapper.length === 0) return { author: "", msgId: "", date: "" };

        let author = "";
        let msgId = "";

        // -------------------------------------------------------------
        // 1. Extração do ID do Post/Mensagem (msgId)
        // -------------------------------------------------------------
        // A. Tenta ler o ID da div interna de conteúdo, que no SMF é tipicamente "msg_12345"
        const $innerDiv = $postElement.closest("[id^='msg_'], .inner[id^='msg_']");
        if ($innerDiv.length > 0) {
            const idAttr = $innerDiv.attr("id");
            const match = /msg_(\d+)/.exec(idAttr);
            if (match) {
                msgId = match[1];
            }
        }

        // B. Fallback: Procura o botão "Citar" (Quote) ou o link direto da mensagem naquele post
        if (!msgId) {
            const $quoteLink = $wrapper.find("a[href*='quote='], a[href*='msg']").first();
            if ($quoteLink.length > 0) {
                const href = $quoteLink.attr("href");
                const quoteMatch = /quote=(\d+)/.exec(href);
                if (quoteMatch) {
                    msgId = quoteMatch[1];
                } else {
                    const msgMatch = /msg=(\d+)/.exec(href);
                    if (msgMatch) {
                        msgId = msgMatch[1];
                    }
                }
            }
        }

        // -------------------------------------------------------------
        // 2. Extração do Autor do Post
        // -------------------------------------------------------------
        // A. Link de perfil contendo "action=profile" (o método mais seguro e universal do SMF em qualquer idioma!)
        const $profileLink = $wrapper.find(".poster a[href*='action=profile'], td.poster a[href*='action=profile']").first();
        if ($profileLink.length > 0) {
            author = $profileLink.text().trim();
        } 
        
        // B. Fallback 1: Primeiro link dentro do bloco do poster
        if (!author) {
            const $firstLink = $wrapper.find(".poster a, td.poster a").first();
            if ($firstLink.length > 0) {
                author = $firstLink.text().trim();
            }
        }

        // C. Fallback 2: Primeiro elemento em negrito (para convidados ou sumários)
        if (!author) {
            const $boldText = $wrapper.find(".poster b, td.poster b, .poster strong, td.poster strong").first();
            if ($boldText.length > 0) {
                author = $boldText.text().replace(/Submetido por:|Enviado por:/gi, "").trim();
            }
        }
        
        // D. Fallback 3: Cabeçalho h4 simples do poster
        if (!author) {
            const $header = $wrapper.find(".poster h4").first();
            if ($header.length > 0) {
                author = $header.text().trim();
            }
        }

        // Limpa quebras de linha e espaços excessivos caso o tema tenha estruturas complexas
        if (author) {
            author = author.split("\n")[0].trim();
        }

        // -------------------------------------------------------------
        // 3. Extração e conversão da Data do Post (date)
        // -------------------------------------------------------------
        let rawDate = "";

        // Método A: Procurar diretamente no bloco .keyinfo por texto entre parênteses angulares « e »
        const $keyinfo = $wrapper.find(".keyinfo").first();
        if ($keyinfo.length > 0) {
            const keyinfoText = $keyinfo.text();
            const startIdx = keyinfoText.indexOf("«");
            const endIdx = keyinfoText.indexOf("»");
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                const candidate = keyinfoText.substring(startIdx, endIdx + 1).trim();
                if (isDateText(candidate)) {
                    rawDate = candidate;
                    console.log("[QuickQuote] Data extraída via Método A (.keyinfo):", rawDate);
                }
            }
        }

        // Método B: Fallback - Procura exaustiva em todos os elementos filhos por marcadores de data
        if (!rawDate) {
            const $allChildElements = $wrapper.find(".smalltext, td.smalltext, td, div, span, *");
            $allChildElements.each(function () {
                const text = $(this).text().trim();
                if (text.length < 100 && isDateText(text)) {
                    rawDate = text;
                    console.log("[QuickQuote] Data extraída via Método B (Varredura):", rawDate);
                    return false; // Termina o loop .each
                }
            });
        }

        const dateTimestamp = parseSMFDate(rawDate);
        console.log(`[QuickQuote] Data bruta: "${rawDate}" -> Timestamp: ${dateTimestamp}`);

        return {
            author: author,
            msgId: msgId,
            date: dateTimestamp
        };
    }

    /**
     * Extrai os detalhes do cabeçalho de uma citação (blockquote), como o autor, link e data.
     */
    function extractQuoteHeaderDetails(blockquote) {
        // Encontra o cabeçalho de citação imediatamente anterior ou o mais próximo possível
        let $header = $(blockquote).prev(".quoteheader");
        if ($header.length === 0) {
            $header = $(blockquote).prevAll(".quoteheader").first();
        }
        if ($header.length === 0) {
            return { author: "", msgId: "", date: "", topicId: "" };
        }

        const $link = $header.find("a").first();
        const href = $link.length > 0 ? $link.attr("href") || "" : "";
        const text = $header.text().trim();

        let author = "";
        let rawDate = "";
        let msgId = "";
        let topicId = "";

        // Tenta extrair ID do tópico e ID da mensagem a partir da ligação
        if (href) {
            const topicMatch = /topic=(\d+)/.exec(href);
            if (topicMatch) {
                topicId = topicMatch[1];
            }
            const msgMatch = /msg=(\d+)/.exec(href);
            if (msgMatch) {
                msgId = msgMatch[1];
            } else {
                const msgMatch2 = /\.msg(\d+)/.exec(href);
                if (msgMatch2) {
                    msgId = msgMatch2[1];
                }
            }
        }

        // Tenta extrair o autor e a data de forma robusta e independente da tradução do fórum
        const cleanText = text.replace(/^(?:Citação de:?|Quote from:?)\s*/i, "").trim();
        const dateMatch = /(Hoje|Ontem|Today|Yesterday|\d{1,2}\s+de\s+\S+|\d{1,2}\s+\S+\s+\d{4}|\d{1,2}[\/\-.]\d{1,2}|\S+\s+\d{1,2},\s+\d{4})/i.exec(cleanText);

        if (dateMatch) {
            author = cleanText.substring(0, dateMatch.index).trim();
            // Remove espaços, traços e dois pontos residuais
            author = author.replace(/[\s\-,:]+$/, "").trim();
            // Remove palavras de ligação de fim de linha (ex: "em", "on", "de", "en", "le")
            author = author.replace(/\b(?:em|on|at|in|de|en|le)$/i, "").trim();
            // Remove novamente quaisquer dois pontos/dashes que fiquem visíveis
            author = author.replace(/[\s\-,:]+$/, "").trim();

            rawDate = cleanText.substring(dateMatch.index).trim();
        } else {
            author = cleanText;
        }

        const dateTimestamp = rawDate ? parseSMFDate(rawDate) : "";

        return {
            author: author,
            msgId: msgId,
            date: dateTimestamp,
            topicId: topicId
        };
    }

    /**
     * Constrói o BBCode de uma citação simples com base nos detalhes fornecidos.
     */
    function buildQuoteBBCode(content, author, topicId, msgId, date, isInnermost) {
        const innerContent = isInnermost ? `${content}\n` : content;
        if (author && topicId && msgId && date) {
            return `[quote author=${author} link=topic=${topicId}.msg${msgId}#msg${msgId} date=${date}]${innerContent}[/quote]\n`;
        } else if (author && topicId && msgId) {
            return `[quote author=${author} link=topic=${topicId}.msg${msgId}#msg${msgId}]${innerContent}[/quote]\n`;
        } else if (author) {
            return `[quote author=${author}]${innerContent}[/quote]\n`;
        } else {
            return `[quote]${innerContent}[/quote]\n`;
        }
    }

    /**
     * Cria e posiciona o balão flutuante por cima da área selecionada.
     */
    function showBubble(selection) {
        // Se já existe um balão ativo, removemo-lo primeiro
        removeBubble();

        if (selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Evita mostrar o balão se o retângulo da seleção for invisível/inválido
        if (rect.width === 0 || rect.height === 0) return;

        // Cria o elemento do balão
        const bubble = document.createElement("div");
        bubble.id = BUBBLE_ID;
        bubble.innerText = "Citar";

        // Adiciona o elemento ao corpo da página
        document.body.appendChild(bubble);
        currentBubble = bubble;

        // Calcula as coordenadas exatas do posicionamento
        const bubbleWidth = bubble.offsetWidth;
        const bubbleHeight = bubble.offsetHeight;

        // Centraliza o balão horizontalmente por cima da seleção
        const left = rect.left + window.scrollX + (rect.width / 2) - (bubbleWidth / 2);
        const top = rect.top + window.scrollY - bubbleHeight - BUBBLE_SPACING;

        bubble.style.left = `${left}px`;
        bubble.style.top = `${top}px`;

        // Associa o clique do botão à função de citação
        bubble.addEventListener("click", function (e) {
            e.stopPropagation();
            insertQuote();
        });
    }

    /**
     * Remove o balão flutuante atual do ecrã.
     */
    function removeBubble() {
        if (currentBubble) {
            currentBubble.remove();
            currentBubble = null;
        }
    }

    /**
     * Formata o texto selecionado e insere-o no editor do fórum.
     * Caso a caixa de texto não esteja visível/presente, redireciona o utilizador
     * para a página de resposta completa com a citação em memória.
     */
    function insertQuote() {
        if (!selectedText || !currentRange || !currentParentPost) return;

        // Extrai o ID do tópico a partir do URL atual
        const topicMatch = /topic=(\d+)/.exec(window.location.href);
        const topicId = topicMatch ? topicMatch[1] : null;

        // 1. Anota todos os blockquotes no post original com seus dados para podermos ler após o clone
        currentParentPost.find("blockquote").each(function () {
            const details = extractQuoteHeaderDetails(this);
            this.setAttribute("data-quote-author", details.author || "");
            this.setAttribute("data-quote-msgid", details.msgId || "");
            this.setAttribute("data-quote-date", details.date || "");
            this.setAttribute("data-quote-topicid", details.topicId || "");
        });

        // 2. Clona o conteúdo do range e serializa para BBCode recursivamente
        const fragment = currentRange.cloneContents();
        let hasWrappedQuote = false;

        function serializeToBBCode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.nodeValue;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const $el = $(node);

                // Ignora cabeçalhos e rodapés de citação
                if ($el.hasClass("quoteheader") || $el.hasClass("quotefooter") || 
                    $el.hasClass("topslice_quote") || $el.hasClass("botslice_quote")) {
                    return "";
                }

                if (node.tagName === "BR") {
                    return "\n";
                }

                if (node.tagName === "BLOCKQUOTE") {
                    hasWrappedQuote = true;
                    const author = node.getAttribute("data-quote-author") || "";
                    const msgId = node.getAttribute("data-quote-msgid") || "";
                    const date = node.getAttribute("data-quote-date") || "";
                    const bqTopicId = node.getAttribute("data-quote-topicid") || "";

                    let innerText = "";
                    node.childNodes.forEach(child => {
                        innerText += serializeToBBCode(child);
                    });

                    return buildQuoteBBCode(innerText.trim(), author, bqTopicId, msgId, date, true);
                }

                let result = "";
                node.childNodes.forEach(child => {
                    result += serializeToBBCode(child);
                });
                return result;
            }

            if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                let result = "";
                node.childNodes.forEach(child => {
                    result += serializeToBBCode(child);
                });
                return result;
            }

            return "";
        }

        let serializedBBCode = serializeToBBCode(fragment);

        // Limpa os atributos temporários do DOM original
        currentParentPost.find("blockquote").each(function () {
            this.removeAttribute("data-quote-author");
            this.removeAttribute("data-quote-msgid");
            this.removeAttribute("data-quote-date");
            this.removeAttribute("data-quote-topicid");
        });

        // 3. Encontra todos os blockquotes que contêm toda a seleção no DOM original
        const commonBlockquotes = [];
        let $curr = $(currentRange.commonAncestorContainer);
        while ($curr.length > 0 && !$curr.is(currentParentPost)) {
            if ($curr.is("blockquote")) {
                commonBlockquotes.push($curr[0]);
            }
            $curr = $curr.parent();
        }

        // 4. Embrulha o BBCode serializado nos blockquotes comuns (do mais interno para o mais externo)
        let finalBBCode = serializedBBCode;
        for (let i = 0; i < commonBlockquotes.length; i++) {
            const bq = commonBlockquotes[i];
            const bqDetails = extractQuoteHeaderDetails(bq);
            const bqTopicId = bqDetails.topicId || topicId;
            const isBqInnermost = (i === 0 && !hasWrappedQuote);
            finalBBCode = buildQuoteBBCode(finalBBCode, bqDetails.author, bqTopicId, bqDetails.msgId, bqDetails.date, isBqInnermost);
        }

        // 5. Embrulha no quote do post principal (mais externo)
        const isPostInnermost = (!hasWrappedQuote && commonBlockquotes.length === 0);
        let quoteBBCode = buildQuoteBBCode(finalBBCode, postAuthor, topicId, postMsgId, postDate, isPostInnermost);

        // Procura a caixa de texto ativa no SMF 2.0.19
        const $textarea = $("textarea#message, .quickReplyContent > textarea");
        
        // Caso A: Caixa de escrita existe e está visível/acessível na página
        if ($textarea.length > 0 && $textarea.is(":visible")) {
            const textareaEl = $textarea[0];
            const caretPos = textareaEl.selectionStart;
            const currentText = $textarea.val();

            // Insere o texto na posição exata do cursor
            const newText = currentText.substring(0, caretPos) + quoteBBCode + currentText.substring(textareaEl.selectionEnd);
            $textarea.val(newText);

            // Move o cursor para a posição seguinte
            const newCaretPos = caretPos + quoteBBCode.length;
            textareaEl.setSelectionRange(newCaretPos, newCaretPos);

            // Foca e desliza suavemente até à caixa de resposta
            $textarea.focus();
            textareaEl.scrollIntoView({ behavior: "smooth", block: "center" });

            // Limpa a seleção e o balão
            window.getSelection().removeAllRanges();
            removeBubble();
        } 
        // Caso B: Não há caixa de escrita visível (ex: utilizador está apenas a ler o tópico normalmente)
        else {
            if (topicId) {
                // Guarda a citação formatada na sessão local
                sessionStorage.setItem("pending_quote", quoteBBCode);

                // Constrói o URL da página de resposta completa do SMF
                const replyURL = `${window.location.origin}${window.location.pathname}?action=post;topic=${topicId}.0`;
                
                console.log(`[QuickQuote] Sem editor ativo. A redirecionar para a página de resposta: ${replyURL}`);
                
                // Redireciona o utilizador
                window.location.href = replyURL;
            } else {
                alert("Não foi possível encontrar a caixa de escrita nem identificar o tópico para resposta.");
                removeBubble();
            }
        }
    }

})();
