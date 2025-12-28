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

    // Event Listener for "Add File" button
    document.getElementById('add-file-btn').addEventListener('click', () => {
        fileInput.value = ''; // Reset input to allow selecting the same file again if needed
        fileInput.click();
    });

    // File Processing
    async function handleFiles(files) {
        showLoader();
        // Do NOT clear processedFiles or resultsList here (Append Mode)

        try {
            let newCount = 0;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                // Prevent duplicates if desired? For now, we allow them as separate entries.

                const fileType = file.name.split('.').pop().toLowerCase();
                const fileNameBase = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

                let markdown = "";

                try {
                    if (fileType === 'pdf') {
                        markdown = await convertPDFToMarkdown(file);
                    } else if (fileType === 'hwpx') {
                        markdown = await convertHWPXToMarkdown(file);
                    } else if (fileType === 'hwp') {
                        throw new Error(`Legacy HWP format (${file.name}) is not supported. Please save as HWPX.`);
                    } else {
                        throw new Error(`Unsupported file format: ${file.name}`);
                    }

                    if (!markdown.trim()) {
                        markdown = `(No text content found in ${file.name})`;
                    }

                    // Create Result Card
                    createResultCard(fileNameBase, markdown);
                    processedFiles.push({ name: fileNameBase, content: markdown });
                    newCount++;

                } catch (err) {
                    console.error(err);
                    createResultCard(fileNameBase, `Error: ${err.message}`, true);
                }
            }

            // Show Section
            loader.classList.add('hidden');
            outputSection.classList.remove('hidden');
            dropZone.style.display = 'none'; // Keep dropzone hidden as we have the "Add File" button now

            if (newCount > 0) {
                showToast(`Added ${newCount} file(s).`);
            }

        } catch (error) {
            console.error(error);
            showToast("An error occurred during processing.");
            loader.classList.add('hidden'); // Hide loader if error
        }
    }

    // PDF Conversion Logic
    // ... (Keep as is)

    // HWPX Conversion Logic
    // ... (Keep as is)

    // ...

    // UI Helpers
    function showLoader() {
        // Only show loader if we are in the initial view, otherwise maybe show a small loading indicator? 
        // For simplicity, we overlay the loader or toggle it. 
        // However, since 'dropZone' might be hidden, we just ensure loader is visible.
        loader.classList.remove('hidden');
    }

    function resetUI() {
        dropContent.classList.remove('hidden');
        loader.classList.add('hidden');
        outputSection.classList.add('hidden');
        fileInput.value = '';
        document.getElementById('results-list').innerHTML = '';
        processedFiles = [];
        dropZone.style.display = 'flex';
    }

    resetBtn.addEventListener('click', () => {
        resetUI();
    });

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
});
