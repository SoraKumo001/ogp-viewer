document.addEventListener('DOMContentLoaded', () => {
    // i18n initialization
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
        if (msg) el.textContent = msg;
    });
    document.querySelectorAll('.ogp-title').forEach(el => el.textContent = chrome.i18n.getMessage("fallbackTitle"));
    document.querySelectorAll('.ogp-desc').forEach(el => el.textContent = chrome.i18n.getMessage("fallbackDesc"));

    // UI Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const previewSections = document.querySelectorAll('.preview-section');
    const toggleSwitch = document.getElementById('x-card-size-toggle');
    const xCard = document.querySelector('.x-card');
    const toggleLabel = document.querySelector('.label-text');
    const rawDataOutput = document.getElementById('raw-data-output');
    
    // Switch Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            previewSections.forEach(s => s.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // Toggle X Card Size
    toggleSwitch.addEventListener('change', (e) => {
        if (e.target.checked) {
            xCard.classList.remove('small');
            xCard.classList.add('large');
            toggleLabel.textContent = chrome.i18n.getMessage("largeImage");
        } else {
            xCard.classList.remove('large');
            xCard.classList.add('small');
            toggleLabel.textContent = chrome.i18n.getMessage("smallImage");
        }
    });

    // Fetch OGP Data from Content Script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTab = tabs[0];
        
        // Execute extraction logic directly natively
        chrome.scripting.executeScript({
            target: {tabId: activeTab.id},
            func: () => {
                const data = {};
                
                // Extract standard Open Graph tags
                const ogTags = document.querySelectorAll('meta[property^="og:"]');
                ogTags.forEach(tag => {
                    const property = tag.getAttribute('property');
                    const content = tag.getAttribute('content');
                    if (property && content) {
                        data[property] = content;
                    }
                });

                // Extract Twitter Cards tags
                const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
                twitterTags.forEach(tag => {
                    const name = tag.getAttribute('name');
                    const content = tag.getAttribute('content');
                    if (name && content) {
                        data[name] = content;
                    }
                });

                // Extract fallbacks
                data['title'] = document.title || '';
                
                const descTag = document.querySelector('meta[name="description"]');
                if (descTag) {
                    data['description'] = descTag.getAttribute('content') || '';
                }

                return data;
            }
        }, (results) => {
            if (chrome.runtime.lastError || !results || !results.length) {
                console.error("Error communicating with content script:", chrome.runtime.lastError);
                document.getElementById('loading').textContent = chrome.i18n.getMessage("errorFetchFailed");
                document.getElementById('loading').classList.add('active');
                return;
            }
            
            document.getElementById('loading').classList.remove('active');
            
            const responseData = results[0].result;
            if (responseData) {
                try {
                    const hostname = new URL(activeTab.url).hostname;
                    updateUI(responseData, hostname);
                } catch (e) {
                    updateUI(responseData, activeTab.url || "unknown");
                }
            }
        });
    });


    function updateUI(data, hostname) {
        // Output raw data
        rawDataOutput.textContent = JSON.stringify(data, null, 2);

        // Map data prioritizations
        const title = data['og:title'] || data['twitter:title'] || data['title'] || chrome.i18n.getMessage("fallbackTitle");
        const description = data['og:description'] || data['twitter:description'] || data['description'] || chrome.i18n.getMessage("fallbackDesc");
        const image = data['og:image'] || data['twitter:image'] || '';
        const siteName = data['og:site_name'] || hostname;

        // Auto-detect twitter card type to set default toggle
        const twitterCardType = data['twitter:card'] || 'summary_large_image';
        if (twitterCardType.toLowerCase() === 'summary') {
            toggleSwitch.checked = false;
            xCard.classList.remove('large');
            xCard.classList.add('small');
            toggleLabel.textContent = chrome.i18n.getMessage("smallImage");
        }

        // Apply to all elements
        document.querySelectorAll('.ogp-title').forEach(el => el.textContent = title);
        document.querySelectorAll('.ogp-desc').forEach(el => el.textContent = description);
        document.querySelectorAll('.ogp-site-name').forEach(el => el.textContent = siteName);
        
        document.querySelectorAll('.ogp-image').forEach(img => {
            if (image) {
                img.src = image;
                img.style.display = 'block';
            } else {
                img.style.display = 'none'; // Fallback if no image
            }
        });
    }
});
