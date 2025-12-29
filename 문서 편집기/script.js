document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const loader = document.getElementById('loader');
    const outputSection = document.getElementById('output-section');
    const dropContent = document.querySelector('.drop-content');
    const mergeBtn = document.getElementById('merge-btn');
    const resetBtn = document.getElementById('reset-btn');
    const toast = document.getElementById('toast');
    const previewSection = document.getElementById('preview-section');
    const pdfPreviewFrame = document.getElementById('pdf-preview-frame');
    const downloadFinalBtn = document.getElementById('download-final-btn');
    const closePreviewBtn = document.getElementById('close-preview-btn');

    let currentMergedPdfUrl = null;

    // State
    let processedFiles = [];

    // Drag & Drop Handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    });

    // Event Listener for "Add File" button
    const addFileBtn = document.getElementById('add-file-btn');
    if (addFileBtn) {
        addFileBtn.addEventListener('click', () => {
            fileInput.value = ''; // Reset input
            fileInput.click();
        });
    }

    // Merge Button Listener
    if (mergeBtn) {
        mergeBtn.addEventListener('click', mergeFiles);
    }

    if (downloadFinalBtn) {
        downloadFinalBtn.addEventListener('click', () => {
            if (currentMergedPdfUrl) {
                const a = document.createElement('a');
                a.href = currentMergedPdfUrl;
                a.download = `Merged_PDF_${new Date().toISOString().slice(0, 10)}.pdf`;
                a.click();
            }
        });
    }

    if (closePreviewBtn) {
        closePreviewBtn.addEventListener('click', () => {
            previewSection.classList.add('hidden');
            // Allow re-merging or other actions
        });
    }

    // File Processing
    async function handleFiles(files) {
        showLoader();

        try {
            let newCount = 0;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileType = file.name.split('.').pop().toLowerCase();
                const fileNameBase = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

                if (fileType !== 'pdf') {
                    showToast(`${file.name} 제외됨: PDF 파일만 지원합니다.`);
                    continue;
                }

                // Store file directly for processing later
                const arrayBuffer = await file.arrayBuffer();

                // Add to list UI
                createResultCard(fileNameBase, arrayBuffer);

                // Add to internal list with default metadata
                processedFiles.push({
                    name: fileNameBase,
                    data: arrayBuffer,
                    id: Date.now() + Math.random() // Unique ID
                });

                newCount++;
            }

            // Show Section
            loader.classList.add('hidden');
            outputSection.classList.remove('hidden');
            dropZone.classList.add('compact');

            if (newCount > 0) {
                showToast(`${newCount}개의 파일이 추가되었습니다.`);
            }

        } catch (error) {
            console.error(error);
            showToast("파일 처리 중 오류가 발생했습니다.");
            loader.classList.add('hidden');
        }
    }

    function createResultCard(fileName, arrayBuffer, isError = false) {
        const resultsList = document.getElementById('results-list');

        const card = document.createElement('div');
        card.className = 'file-card';
        // Attach raw data to DOM element for easy retrieval during merge
        card.rawBuffer = arrayBuffer;

        const header = document.createElement('div');
        header.className = 'file-header-bar';
        header.style.alignItems = 'center';

        // Title Section
        const infoSection = document.createElement('div');
        infoSection.style.flex = '1';
        infoSection.style.display = 'flex';
        infoSection.style.alignItems = 'center';
        infoSection.style.gap = '0.5rem';

        const title = document.createElement('div');
        title.className = 'file-title';
        title.innerHTML = `📄 <b>${fileName}</b>`;
        infoSection.appendChild(title);

        header.appendChild(infoSection);

        const actions = document.createElement('div');
        actions.className = 'file-actions';

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-sm delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.onclick = () => {
            card.remove();
        };
        actions.appendChild(deleteBtn);

        header.appendChild(actions);
        card.appendChild(header);
        resultsList.appendChild(card);
    }

    // Merge Logic (PDF)
    async function mergeFiles() {
        const cards = document.querySelectorAll('.file-card');
        if (cards.length === 0) {
            showToast("병합할 파일이 없습니다.");
            return;
        }

        showToast("PDF 병합 중... 잠시만 기다려주세요.");
        const { PDFDocument, rgb, StandardFonts } = PDFLib;

        try {
            // 1. Collect Data
            const filesData = [];
            cards.forEach(card => {
                const titleEl = card.querySelector('.file-title b');
                const buffer = card.rawBuffer;
                // Ensure buffer exists and is ArrayBuffer
                if (buffer && buffer.byteLength > 0) {
                    const fileName = titleEl ? titleEl.textContent : 'Untitled';
                    filesData.push({ fileName, buffer });
                }
            });

            if (filesData.length === 0) {
                throw new Error("처리할 유효한 파일 데이터가 없습니다.");
            }

            // 2. Create PDF
            const mergedPdf = await PDFDocument.create();

            // Font Handling
            let customFont = null;
            let fontToUse = null;

            // Try to load Korean font
            try {
                if (window.fontkit) {
                    mergedPdf.registerFontkit(window.fontkit);
                    // Use a reliable URL or fallback.
                    // Note: downloading large fonts client-side can be slow/flaky.
                    // We'll try the CDN.
                    const fontUrl = 'https://unpkg.com/@fontsource/noto-sans-kr@5.0.1/files/noto-sans-kr-korean-400-normal.woff';
                    const fontBytes = await fetch(fontUrl).then(res => {
                        if (!res.ok) throw new Error("Font fetch failed");
                        return res.arrayBuffer();
                    });
                    customFont = await mergedPdf.embedFont(fontBytes);
                    fontToUse = customFont;
                } else {
                    console.warn("Fontkit not found, using Standard Font (Korean may not render)");
                }
            } catch (fontErr) {
                console.warn("Failed to load Korean font, falling back to standard font.", fontErr);
            }

            // Fallback to Standard Font if Custom failed (but this won't show Korean)
            if (!fontToUse) {
                fontToUse = await mergedPdf.embedFont(StandardFonts.Helvetica);
                showToast("경고: 한글 폰트 로드 실패. 한글이 깨질 수 있습니다.");
            }

            // 3. Create TOC Page
            // If user really wants "Editable HTML", PDF is not it. 
            // But we will give them a clean PDF TOC first.

            let tocPage = mergedPdf.addPage();
            const { width, height } = tocPage.getSize();
            let y = height - 50;

            tocPage.drawText('목차', {
                x: 50,
                y,
                size: 20,
                font: fontToUse,
                color: rgb(0, 0, 0),
            });
            y -= 40;

            // Draw header
            tocPage.drawText('순번       파일명', { x: 50, y, size: 12, font: fontToUse });
            tocPage.drawText('페이지', { x: 450, y, size: 12, font: fontToUse });
            y -= 10;
            tocPage.drawLine({ start: { x: 50, y }, end: { x: 500, y }, thickness: 1 });
            y -= 25;

            // 4. Content Embedding
            let currentPageIndex = 1; // TOC is page 1 (approx)
            // We need to calculate TOC pages? For now assume 1 page TOC.

            for (let i = 0; i < filesData.length; i++) {
                const file = filesData[i];
                // Load the source PDF
                const srcPdf = await PDFDocument.load(file.buffer);
                const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());

                // Add Entry to TOC
                const startPage = currentPageIndex + 1;
                const indexNum = i + 1;
                const fileLabel = `${indexNum}.    ${file.fileName}`;

                // Sanitize text if using standard font (remove Korean chars to prevent crash?)
                // PDFLib might crash if we try to draw unavailable chars.
                // For now, we trust the Custom Font loaded.

                try {
                    tocPage.drawText(fileLabel, {
                        x: 50,
                        y,
                        size: 11,
                        font: fontToUse,
                        color: rgb(0, 0, 0),
                    });

                    tocPage.drawText(String(startPage), {
                        x: 450,
                        y,
                        size: 11,
                        font: fontToUse,
                    });
                } catch (drawErr) {
                    console.error("Error drawing text (likely encoding):", drawErr);
                    tocPage.drawText(`${indexNum}. [Text Error]`, { x: 50, y, size: 11, font: fontToUse });
                }

                y -= 20;
                if (y < 50) {
                    tocPage = mergedPdf.addPage();
                    y = height - 50;
                }

                // Append pages
                copiedPages.forEach((page) => {
                    mergedPdf.addPage(page);
                    currentPageIndex++;
                });
            }

            // Save and Preview
            const pdfBytes = await mergedPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });

            // Cleanup old URL
            if (currentMergedPdfUrl) URL.revokeObjectURL(currentMergedPdfUrl);

            currentMergedPdfUrl = URL.createObjectURL(blob);

            // Show Preview Section
            previewSection.classList.remove('hidden');
            pdfPreviewFrame.src = currentMergedPdfUrl;

            // Scroll to preview
            previewSection.scrollIntoView({ behavior: 'smooth' });

            showToast("PDF 통합이 완료되었습니다! 미리보기를 확인하세요.");

        } catch (err) {
            console.error(err);
            showToast("병합 중 오류가 발생했습니다: " + err.message);
        }
    }

    // UI Helpers
    function showLoader() {
        if (loader) loader.classList.remove('hidden');
    }

    function resetUI() {
        dropContent.classList.remove('hidden');
        loader.classList.add('hidden');
        outputSection.classList.add('hidden');
        fileInput.value = '';
        const list = document.getElementById('results-list');
        if (list) list.innerHTML = '';
        processedFiles = [];
        dropZone.style.display = 'flex';
        dropZone.classList.remove('compact');
        previewSection.classList.add('hidden');
        if (currentMergedPdfUrl) {
            URL.revokeObjectURL(currentMergedPdfUrl);
            currentMergedPdfUrl = null;
        }
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetUI();
        });
    }

    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
});
