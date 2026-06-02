/**
 * heic-handler.js
 * 
 * Módulo responsável pela deteção e conversão de imagens do formato Apple HEIC/HEIF
 * para o formato compatível com a web (JPEG).
 * 
 * Este módulo utiliza a biblioteca 'heic2any' em segundo plano.
 */

"use strict";

window.HeicHandler = (function () {
    
    // Qualidade padrão de compressão JPEG resultante (entre 0.0 e 1.0)
    const JPEG_QUALITY = 0.85;

    /**
     * Verifica se um determinado ficheiro está no formato HEIC ou HEIF.
     * A verificação é feita tanto pelo tipo MIME do ficheiro como pela extensão do nome.
     * 
     * @param {File} file - O ficheiro a ser verificado.
     * @returns {boolean} - true se for um ficheiro HEIC/HEIF, false caso contrário.
     */
    function isHeic(file) {
        if (!file) return false;

        const mimeType = (file.type || "").toLowerCase();
        const fileName = (file.name || "").toLowerCase();

        // Verifica o tipo MIME oficial ou comum do HEIC
        const hasHeicMime = mimeType === "image/heic" || mimeType === "image/heif";
        
        // Verifica a extensão do ficheiro como fallback de segurança
        const hasHeicExtension = fileName.endsWith(".heic") || fileName.endsWith(".heif");

        return hasHeicMime || hasHeicExtension;
    }

    /**
     * Converte um ficheiro HEIC/HEIF para um ficheiro JPEG (Blob/File).
     * 
     * @param {File} heicFile - O ficheiro de origem em formato HEIC.
     * @returns {Promise<File>} - Uma Promise que resolve no novo objeto File convertido para JPEG.
     */
    function convertToJpeg(heicFile) {
        return new Promise((resolve, reject) => {
            // Verifica se a biblioteca heic2any foi corretamente carregada no escopo global
            if (typeof window.heic2any !== "function") {
                return reject(new Error("A biblioteca de conversão 'heic2any' não foi encontrada."));
            }

            console.log(`[HEIC] A iniciar conversão do ficheiro: ${heicFile.name} (${(heicFile.size / 1024 / 1024).toFixed(2)} MB)`);

            // Executa a conversão usando as opções recomendadas
            window.heic2any({
                blob: heicFile,
                toType: "image/jpeg",
                quality: JPEG_QUALITY
            })
            .then((result) => {
                // Se a conversão resultar num array (ex: múltiplas imagens no mesmo HEIC), usamos a primeira
                const jpegBlob = Array.isArray(result) ? result[0] : result;

                // Cria o nome do novo ficheiro substituindo a extensão original por .jpg
                const originalName = heicFile.name || "imagem.heic";
                const newName = originalName.replace(/\.(heic|heif)$/i, ".jpg");

                // Cria um novo objeto File a partir do Blob resultante para compatibilidade total de upload
                const convertedFile = new File([jpegBlob], newName, {
                    type: "image/jpeg",
                    lastModified: Date.now()
                });

                console.log(`[HEIC] Conversão concluída com sucesso: ${newName} (${(convertedFile.size / 1024 / 1024).toFixed(2)} MB)`);
                resolve(convertedFile);
            })
            .catch((error) => {
                console.error("[HEIC] Erro durante a conversão do ficheiro:", error);
                reject(error);
            });
        });
    }

    // Expõe a API pública do módulo de forma organizada
    return {
        isHeic: isHeic,
        convertToJpeg: convertToJpeg
    };

})();
