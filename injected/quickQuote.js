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

            // Submete automaticamente se a flag de Quick Quote estiver ativa
            const autoSubmit = sessionStorage.getItem("pending_quote_auto_submit");
            if (autoSubmit === "true") {
                sessionStorage.removeItem("pending_quote_auto_submit");
                let $form = $textarea.closest("form");
                if ($form.length > 0) {
                    let $submitBtn = $form.find("input[type='submit'][name='post'], input[type='submit']");
                    if ($submitBtn.length > 0) {
                        $submitBtn.click();
                    } else {
                        $form.submit();
                    }
                }
            }
        }
    }

    /**
     * Trata o evento de mouseup para detetar se há texto selecionado.
     */
    function handleMouseUp(e) {
        // Se o clique foi no próprio balão, não fazemos nada para evitar limpar as variáveis do range
        if (currentBubble && currentBubble.contains(e.target)) {
            return;
        }

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
            let $parentPost = $(selection.anchorNode).closest(".post, .inner");
            if ($parentPost.length === 0) {
                // Caso não esteja em .post ou .inner, verifica se está na tabela do sumário de tópicos
                const $inSummary = $(selection.anchorNode).closest("#topic_summary_area, #topic_summary");
                if ($inSummary.length > 0) {
                    // No sumário de tópicos, o texto da publicação fica dentro das linhas tr ou células td
                    $parentPost = $(selection.anchorNode).closest("tr");
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
        const trimmedContent = content.trim();
        const innerContent = isInnermost ? `${trimmedContent}\n` : trimmedContent;
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

        // 1. Botão Quote
        const btnQuote = document.createElement("div");
        btnQuote.className = "qq-btn";
        btnQuote.id = "qq-btn-quote";
        btnQuote.innerText = "Quote";
        btnQuote.addEventListener("click", function (e) {
            e.stopPropagation();
            insertQuote("quote");
        });

        // 2. Botão Copy
        const btnCopy = document.createElement("div");
        btnCopy.className = "qq-btn";
        btnCopy.id = "qq-btn-copy";
        btnCopy.innerText = "Copy";
        btnCopy.addEventListener("click", function (e) {
            e.stopPropagation();
            insertQuote("copy");
        });

        // Adiciona os botões na horizontal
        bubble.appendChild(btnQuote);
        bubble.appendChild(btnCopy);

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
     */
    function insertQuote(mode) {
        if (!selectedText || !currentRange || !currentParentPost) return;

        // Extrai o ID do tópico a partir do URL atual
        const topicMatch = /topic=(\d+)/.exec(window.location.href);
        const topicId = topicMatch ? topicMatch[1] : null;

        // 1. Deteta se a seleção está dentro ou adjacente a uma lista (UL/OL)
        let listNode = null;
        
        // A. Verifica se o nó comum da seleção ou algum pai é um UL/OL ou LI
        let $currList = $(currentRange.commonAncestorContainer);
        while ($currList.length > 0 && !$currList.is(currentParentPost)) {
            if ($currList.is("ul, ol")) {
                listNode = $currList[0];
                break;
            }
            if ($currList.is("li")) {
                const parentList = $currList.closest("ul, ol");
                if (parentList.length > 0) {
                    listNode = parentList[0];
                }
                break;
            }
            $currList = $currList.parent();
        }

        // B. Se não encontrou, verifica a partir de startContainer da seleção ativa
        if (!listNode && currentRange.startContainer) {
            let curr = currentRange.startContainer.nodeType === Node.TEXT_NODE ? currentRange.startContainer.parentNode : currentRange.startContainer;
            while (curr && !$(curr).is(currentParentPost)) {
                if (curr.nodeName === "UL" || curr.nodeName === "OL") {
                    listNode = curr;
                    break;
                }
                if (curr.nodeName === "LI") {
                    const parentList = $(curr).closest("ul, ol");
                    if (parentList.length > 0) {
                        listNode = parentList[0];
                    }
                    break;
                }
                
                // Verifica se o irmão seguinte é uma lista ou contém uma lista
                let next = curr.nextElementSibling;
                if (next) {
                    if (next.tagName === "UL" || next.tagName === "OL") {
                        listNode = next;
                        break;
                    }
                    const foundList = next.querySelector("ul, ol");
                    if (foundList) {
                        listNode = foundList;
                        break;
                    }
                }
                
                // Tratamento específico de spoilers: se estiver no cabeçalho, procura a lista no corpo seguinte
                if ($(curr).hasClass("sp-head")) {
                    let nextBody = curr.nextElementSibling;
                    if (nextBody && $(nextBody).hasClass("sp-body")) {
                        const foundList = nextBody.querySelector("ul, ol");
                        if (foundList) {
                            listNode = foundList;
                            break;
                        }
                    }
                }
                curr = curr.parentNode;
            }
        }

        let styleAttr = listNode ? (listNode.getAttribute("style") || "") : "";
        let isDecimal = listNode && (listNode.tagName === "OL" || styleAttr.includes("list-style-type: decimal") || styleAttr.includes("list-style-type:decimal"));
        let $spoiler = listNode ? $(listNode).closest(".sp-wrap") : [];
        let hasSpoiler = $spoiler.length > 0;

        // Determine if we should expand the selection to the entire list/spoiler
        let shouldExpandEntirely = false;
        let expandTarget = null;

        let $quoteHeader = $(currentRange.commonAncestorContainer).closest(".quoteheader");
        if ($quoteHeader.length === 0 && currentRange.startContainer) {
            $quoteHeader = $(currentRange.startContainer).closest(".quoteheader");
        }

        if ($quoteHeader.length > 0) {
            let nextEl = $quoteHeader[0].nextElementSibling;
            while (nextEl && nextEl.tagName !== "BLOCKQUOTE") {
                nextEl = nextEl.nextElementSibling;
            }
            if (nextEl && nextEl.tagName === "BLOCKQUOTE") {
                shouldExpandEntirely = true;
                expandTarget = nextEl;
            }
        } else if (hasSpoiler) {
            if ($(currentRange.commonAncestorContainer).closest(".sp-wrap").is($spoiler)) {
                shouldExpandEntirely = true;
                expandTarget = $spoiler[0];
            }
        } else if (listNode && isDecimal) {
            if ($(currentRange.commonAncestorContainer).closest(listNode).length > 0) {
                shouldExpandEntirely = true;
                expandTarget = listNode;
            }
        }

        // 1. Anota os blockquotes no post original com seus dados para podermos ler após o clone
        currentParentPost.find("blockquote").each(function () {
            const details = extractQuoteHeaderDetails(this);
            this.setAttribute("data-quote-author", details.author || "");
            this.setAttribute("data-quote-msgid", details.msgId || "");
            this.setAttribute("data-quote-date", details.date || "");
            this.setAttribute("data-quote-topicid", details.topicId || "");
        });

        // 2. Anota listas decimais e spoilers para forçar a serialização total
        const decimalLists = [];
        currentParentPost.find("ul, ol").each(function () {
            let sAttr = this.getAttribute("style") || "";
            let isDec = this.tagName === "OL" || sAttr.includes("list-style-type: decimal") || sAttr.includes("list-style-type:decimal");
            if (isDec) {
                this.setAttribute("data-decimal-list-index", decimalLists.length);
                decimalLists.push(this);
            }
        });

        const spoilers = [];
        currentParentPost.find(".sp-wrap").each(function () {
            this.setAttribute("data-spoiler-index", spoilers.length);
            spoilers.push(this);
        });

        // 3. Clona o conteúdo correspondente
        let fragment;
        if (shouldExpandEntirely && expandTarget) {
            const tempRange = document.createRange();
            tempRange.selectNode(expandTarget);
            fragment = tempRange.cloneContents();
        } else {
            fragment = currentRange.cloneContents();
        }
        let hasWrappedQuote = false;

        function serializeToBBCode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.nodeValue;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const $el = $(node);

                if ($el.hasClass("quoteheader") || $el.hasClass("quotefooter") || 
                    $el.hasClass("topslice_quote") || $el.hasClass("botslice_quote")) {
                    return "";
                }

                if (node.tagName === "BR") {
                    return "\n";
                }

                let spoilerIdxAttr = node.getAttribute("data-spoiler-index");
                if (spoilerIdxAttr !== null) {
                    let idx = parseInt(spoilerIdxAttr);
                    let origSpoiler = spoilers[idx];
                    if (origSpoiler) {
                        origSpoiler.removeAttribute("data-spoiler-index");
                        let res = serializeSpoilerNode(origSpoiler);
                        origSpoiler.setAttribute("data-spoiler-index", spoilerIdxAttr);
                        return res;
                    }
                }

                let decimalListIdxAttr = node.getAttribute("data-decimal-list-index");
                if (decimalListIdxAttr !== null) {
                    let idx = parseInt(decimalListIdxAttr);
                    let origList = decimalLists[idx];
                    if (origList) {
                        origList.removeAttribute("data-decimal-list-index");
                        let res = serializeListNode(origList);
                        origList.setAttribute("data-decimal-list-index", decimalListIdxAttr);
                        return res;
                    }
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

                if (node.tagName === "UL" || node.tagName === "OL") {
                    return serializeListNode(node);
                }

                if (node.tagName === "LI") {
                    let innerText = "";
                    node.childNodes.forEach(child => {
                        innerText += serializeToBBCode(child);
                    });
                    return `[li]${innerText.trim()}[/li]\n`;
                }

                if ($el.hasClass("sp-wrap")) {
                    return serializeSpoilerNode(node);
                }

                if ($el.hasClass("sp-head")) {
                    return "";
                }

                if (node.tagName === "DIV" || node.tagName === "P") {
                    let alignAttr = node.getAttribute("align");
                    let styleAttr = node.getAttribute("style") || "";
                    let align = alignAttr;
                    if (!align && styleAttr.includes("text-align")) {
                        let match = /text-align:\s*(\w+)/.exec(styleAttr);
                        if (match) align = match[1];
                    }
                    
                    let innerText = "";
                    node.childNodes.forEach(child => {
                        innerText += serializeToBBCode(child);
                    });
                    
                    if (align) {
                        if (align.toLowerCase() === "center") {
                            return `[center]${innerText.trim()}[/center]\n`;
                        } else {
                            return `[align=${align}]${innerText.trim()}[/align]\n`;
                        }
                    }
                    // Se não tiver alinhamento, apenas processa os filhos
                    return innerText;
                }

                if (node.tagName === "SPAN" || node.tagName === "FONT") {
                    let styleAttr = node.getAttribute("style") || "";
                    let colorAttr = node.getAttribute("color");
                    let sizeAttr = node.getAttribute("size");
                    
                    let color = colorAttr;
                    if (!color && styleAttr.includes("color")) {
                        let match = /color:\s*([^;]+)/.exec(styleAttr);
                        if (match) color = match[1].trim();
                    }
                    
                    let size = sizeAttr;
                    if (!size && styleAttr.includes("font-size")) {
                        let match = /font-size:\s*([^;]+)/.exec(styleAttr);
                        if (match) size = match[1].trim();
                    }
                    
                    let innerText = "";
                    node.childNodes.forEach(child => {
                        innerText += serializeToBBCode(child);
                    });
                    
                    let result = innerText;
                    if (size) {
                        result = `[size=${size}]${result}[/size]`;
                    }
                    if (color) {
                        result = `[color=${color}]${result}[/color]`;
                    }
                    return result;
                }

                if (node.tagName === "B" || node.tagName === "STRONG") {
                    let innerText = "";
                    node.childNodes.forEach(child => {
                        innerText += serializeToBBCode(child);
                    });
                    return `[b]${innerText}[/b]`;
                }

                if (node.tagName === "I" || node.tagName === "EM") {
                    let innerText = "";
                    node.childNodes.forEach(child => {
                        innerText += serializeToBBCode(child);
                    });
                    return `[i]${innerText}[/i]`;
                }

                if (node.tagName === "U") {
                    let innerText = "";
                    node.childNodes.forEach(child => {
                        innerText += serializeToBBCode(child);
                    });
                    return `[u]${innerText}[/u]`;
                }

                if (node.tagName === "S" || node.tagName === "STRIKE") {
                    let innerText = "";
                    node.childNodes.forEach(child => {
                        innerText += serializeToBBCode(child);
                    });
                    return `[s]${innerText}[/s]`;
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

        function serializeListNode(listEl) {
            let typeAttr = listEl.getAttribute("type");
            let sAttr = listEl.getAttribute("style") || "";
            let isDec = listEl.tagName === "OL" || sAttr.includes("list-style-type: decimal") || sAttr.includes("list-style-type:decimal");
            
            let innerText = "";
            listEl.childNodes.forEach(child => {
                innerText += serializeToBBCode(child);
            });
            
            if (isDec) {
                return `[list type=decimal]\n${innerText.trim()}\n[/list]\n`;
            } else if (typeAttr) {
                return `[list type=${typeAttr}]\n${innerText.trim()}\n[/list]\n`;
            } else {
                return `[list]\n${innerText.trim()}\n[/list]\n`;
            }
        }

        function serializeSpoilerNode(spoilerEl) {
            const $el = $(spoilerEl);
            const $head = $el.find(".sp-head").first();
            const $body = $el.find(".sp-body").first();
            const title = $head.length > 0 ? $head.text().trim() : "";
            
            let innerText = "";
            if ($body.length > 0) {
                $body[0].childNodes.forEach(child => {
                    innerText += serializeToBBCode(child);
                });
            }
            
            if (title) {
                return `[spoiler=${title}]\n${innerText.trim()}\n[/spoiler]\n`;
            } else {
                return `[spoiler]\n${innerText.trim()}\n[/spoiler]\n`;
            }
        }

        let serializedBBCode = serializeToBBCode(fragment);

        // Se a seleção estava inteiramente dentro de elementos de estilo no DOM original, preserva-os
        let insideBold = $(currentRange.commonAncestorContainer).closest("b, strong");
        let insideItalic = $(currentRange.commonAncestorContainer).closest("i, em");
        let insideUnderline = $(currentRange.commonAncestorContainer).closest("u");
        let insideStrike = $(currentRange.commonAncestorContainer).closest("s, strike");

        let align = null;
        let size = null;
        let color = null;

        // Procura alinhamento nos pais no DOM original
        let $alignParent = $(currentRange.commonAncestorContainer).closest("[align], div, p");
        $alignParent.each(function () {
            if (this === currentParentPost[0]) return; // Para no post wrapper
            let alignAttr = this.getAttribute("align");
            let styleAttr = this.getAttribute("style") || "";
            if (alignAttr) {
                align = alignAttr;
                return false;
            }
            if (styleAttr.includes("text-align")) {
                let match = /text-align:\s*(\w+)/.exec(styleAttr);
                if (match) {
                    align = match[1];
                    return false;
                }
            }
        });

        // Procura cor e tamanho nos pais no DOM original
        let $styleParent = $(currentRange.commonAncestorContainer).closest("[color], [size], span, font");
        $styleParent.each(function () {
            if (this === currentParentPost[0]) return;
            let colorAttr = this.getAttribute("color");
            let sizeAttr = this.getAttribute("size");
            let styleAttr = this.getAttribute("style") || "";
            
            if (colorAttr && !color) color = colorAttr;
            if (sizeAttr && !size) size = sizeAttr;
            
            if (styleAttr.includes("color") && !color) {
                let match = /color:\s*([^;]+)/.exec(styleAttr);
                if (match) color = match[1].trim();
            }
            if (styleAttr.includes("font-size") && !size) {
                let match = /font-size:\s*([^;]+)/.exec(styleAttr);
                if (match) size = match[1].trim();
            }
        });

        if (insideBold.length > 0) {
            serializedBBCode = `[b]${serializedBBCode}[/b]`;
        }
        if (insideItalic.length > 0) {
            serializedBBCode = `[i]${serializedBBCode}[/i]`;
        }
        if (insideUnderline.length > 0) {
            serializedBBCode = `[u]${serializedBBCode}[/u]`;
        }
        if (insideStrike.length > 0) {
            serializedBBCode = `[s]${serializedBBCode}[/s]`;
        }
        if (size) {
            serializedBBCode = `[size=${size}]${serializedBBCode}[/size]`;
        }
        if (color) {
            serializedBBCode = `[color=${color}]${serializedBBCode}[/color]`;
        }
        if (align) {
            if (align.toLowerCase() === "center") {
                serializedBBCode = `[center]${serializedBBCode}[/center]`;
            } else {
                serializedBBCode = `[align=${align}]${serializedBBCode}[/align]`;
            }
        }

        let insideLi = $(currentRange.commonAncestorContainer).closest("li");
        if (listNode && !isDecimal && !hasSpoiler && !shouldExpandEntirely && insideLi.length > 0) {
            serializedBBCode = `[list]\n[li]${serializedBBCode.trim()}[/li]\n[/list]\n`;
        }

        // Limpa os atributos temporários do DOM original
        currentParentPost.find("blockquote").each(function () {
            this.removeAttribute("data-quote-author");
            this.removeAttribute("data-quote-msgid");
            this.removeAttribute("data-quote-date");
            this.removeAttribute("data-quote-topicid");
        });
        currentParentPost.find("ul, ol").each(function () {
            this.removeAttribute("data-decimal-list-index");
        });
        currentParentPost.find(".sp-wrap").each(function () {
            this.removeAttribute("data-spoiler-index");
        });

        // 4. Encontra todos os blockquotes que contêm toda a seleção no DOM original
        const commonBlockquotes = [];
        let $curr = $(currentRange.commonAncestorContainer);
        while ($curr.length > 0 && !$curr.is(currentParentPost)) {
            if ($curr.is("blockquote")) {
                commonBlockquotes.push($curr[0]);
            }
            $curr = $curr.parent();
        }

        // 5. Embrulha o BBCode serializado nos blockquotes comuns (do mais interno para o mais externo)
        let finalBBCode = serializedBBCode;
        for (let i = 0; i < commonBlockquotes.length; i++) {
            const bq = commonBlockquotes[i];
            const bqDetails = extractQuoteHeaderDetails(bq);
            const bqTopicId = bqDetails.topicId || topicId;
            const isBqInnermost = (i === 0 && !hasWrappedQuote);
            finalBBCode = buildQuoteBBCode(finalBBCode, bqDetails.author, bqTopicId, bqDetails.msgId, bqDetails.date, isBqInnermost);
        }

        // 6. Embrulha no quote do post principal (mais externo) se não for modo Copy
        let quoteBBCode;
        if (mode === "copy") {
            quoteBBCode = finalBBCode;
        } else {
            const isPostInnermost = (!hasWrappedQuote && commonBlockquotes.length === 0);
            quoteBBCode = buildQuoteBBCode(finalBBCode, postAuthor, topicId, postMsgId, postDate, isPostInnermost);
        }

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

            // Se for Quick Quote, submete automaticamente a resposta
            if (mode === "quick") {
                let $form = $textarea.closest("form");
                if ($form.length > 0) {
                    let $submitBtn = $form.find("input[type='submit'][name='post'], input[type='submit']");
                    if ($submitBtn.length > 0) {
                        $submitBtn.click();
                    } else {
                        $form.submit();
                    }
                }
            }
        } 
        // Caso B: Não há caixa de escrita visível (ex: utilizador está apenas a ler o tópico normalmente)
        else {
            if (topicId) {
                // Guarda a citação formatada na sessão local
                sessionStorage.setItem("pending_quote", quoteBBCode);

                if (mode === "quick") {
                    sessionStorage.setItem("pending_quote_auto_submit", "true");
                }

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
