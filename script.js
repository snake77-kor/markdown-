document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const loader = document.getElementById('loader');
    const outputSection = document.getElementById('output-section');
    const dropContent = document.querySelector('.drop-content');
    const markdownOutput = document.getElementById('markdown-output');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');
    const toast = document.getElementById('toast');

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

    // File Processing
    async function handleFiles(files) {
        showLoader();
        processedFiles = [];
        let combinedMarkdown = "";

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileType = file.name.split('.').pop().toLowerCase();
                const fileNameBase = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

                let markdown = "";

                try {
                    if (fileType === 'pdf') {
                        markdown = await convertPDFToMarkdown(file);
                    } else if (fileType === 'hwpx') {
                        markdown = await convertHWPXToMarkdown(file);
                    } else if (fileType === 'hwp') {
                        throw new Error(`Legacy HWP format (${file.name}) is not supported. Please use HWPX or PDF.`);
                    } else {
                        throw new Error(`Unsupported file format: ${file.name}`);
                    }

                    if (!markdown.trim()) {
                        console.warn(`No text content in ${file.name}`);
                        markdown = `(No text content found in ${file.name})`;
                    }

                    processedFiles.push({
                        name: fileNameBase,
                        content: markdown
                    });

                    combinedMarkdown += `# File: ${file.name}\n\n${markdown}\n\n---\n\n`;

                } catch (err) {
                    console.error(err);
                    combinedMarkdown += `# File: ${file.name}\n\nError: ${err.message}\n\n---\n\n`;
                }
            }

            if (processedFiles.length === 0) {
                throw new Error("No files were successfully processed.");
            }

            showOutput(combinedMarkdown);
            showToast(`Successfully processed ${processedFiles.length} file(s)!`);

        } catch (error) {
            console.error(error);
            showToast(error.message || "An error occurred during conversion.");
            resetUI();
        }
    }

    // PDF Conversion Logic
    async function convertPDFToMarkdown(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Simple layout reconstruction based on Y position
            let lastY = -1;
            let pageText = "";

            // Sort items by Y (descending) then X (ascending) to ensure reading order
            const items = textContent.items.sort((a, b) => {
                if (Math.abs(b.transform[5] - a.transform[5]) > 5) { // Line threshold
                    return b.transform[5] - a.transform[5];
                }
                return a.transform[4] - b.transform[4];
            });

            for (const item of items) {
                const text = item.str;
                const currentY = item.transform[5]; // Y-coordinate

                if (lastY !== -1 && Math.abs(currentY - lastY) > 10) {
                    pageText += "\n";
                } else if (lastY !== -1) {
                    pageText += " "; // Space between words on same line
                }

                pageText += text;
                lastY = currentY;
            }

            fullText += `## Page ${i}\n\n${pageText}\n\n---\n\n`;
        }

        return fullText;
    }

    // HWPX Conversion Logic (XML Parsing)
    async function convertHWPXToMarkdown(file) {
        const zip = await JSZip.loadAsync(file);

        // HWPX usually stores content in Contents/section0.xml
        // We might need to handle multiple sections
        let fullText = "";

        // Find section files
        const sectionFiles = Object.keys(zip.files).filter(path => path.match(/Contents\/section\d+\.xml/));

        if (sectionFiles.length === 0) {
            throw new Error("Invalid HWPX structure. No content sections found.");
        }

        // Sort sections (section0.xml, section1.xml...)
        sectionFiles.sort();

        for (const sectionPath of sectionFiles) {
            const xmlContent = await zip.file(sectionPath).async("string");
            fullText += parseHWPXXML(xmlContent);
        }

        return fullText;
    }

    function parseHWPXXML(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");

        let text = "";

        // HWPX uses <hp:t> tags for text
        const textNodes = xmlDoc.getElementsByTagName("hp:t");

        // Basic extraction: iterate and grab text. 
        // Improvement: Look for paragraph tags <hp:p> to add newlines.

        const paragraphs = xmlDoc.getElementsByTagName("hp:p");

        for (let p of paragraphs) {
            let pText = "";
            const tNodes = p.getElementsByTagName("hp:t");
            for (let t of tNodes) {
                pText += t.textContent;
            }
            // Check for empty paragraphs (spacing)
            if (pText.trim().length > 0) {
                text += pText + "\n\n";
            }
        }

        return text;
    }

    // UI Helpers
    function showLoader() {
        dropContent.classList.add('hidden');
        loader.classList.remove('hidden');
    }

    function resetUI() {
        dropContent.classList.remove('hidden');
        loader.classList.add('hidden');
        outputSection.classList.add('hidden');
        fileInput.value = '';
        processedFiles = []; // Clear processed files on reset
    }

    function showOutput(markdown) {
        loader.classList.add('hidden');
        outputSection.classList.remove('hidden');
        dropZone.style.display = 'none'; // Hide dropzone completely on result
        markdownOutput.value = markdown;
    }

    resetBtn.addEventListener('click', () => {
        dropZone.style.display = 'flex';
        resetUI();
    });

    // Copy & Download
    copyBtn.addEventListener('click', () => {
        markdownOutput.select();
        document.execCommand('copy');
        showToast("Copied to clipboard!");
    });

    downloadBtn.addEventListener('click', async () => {
        if (processedFiles.length === 1) {
            const file = processedFiles[0];
            const blob = new Blob([file.content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${file.name}.md`;
            a.click();
            URL.revokeObjectURL(url);
        } else if (processedFiles.length > 1) {
            const zip = new JSZip();
            processedFiles.forEach(file => {
                zip.file(`${file.name}.md`, file.content);
            });

            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'converted_docs.zip';
            a.click();
            URL.revokeObjectURL(url);
        }
    });

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
});
