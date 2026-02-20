import puppeteer from 'puppeteer';

async function testFullScraper() {
  console.log('🤖 LINKEDIN LIKE COUNT SCRAPER');
  console.log('='.repeat(60));
  
  // GET YOUR FRESH COOKIE
  const YOUR_LI_AT_COOKIE = 'AQEDAWCbfhcC9KAoAAABnEfNJOUAAAGca9mo5VYAJRdrHcATQEvRgfKq8gYQLVwFPTQoyNvD4HZJkKJ0QzJO6Isqr9r3v9L1ht_AR0IniqQdT-uUg37qYukxwHiK41wJ7UMwv1pDIC6A_hnXVkD2nJtB';
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
      '--disable-infobars',
      '--disable-notifications',
      '--window-size=1920,1080'
    ],
    defaultViewport: null,
    timeout: 180000
  });
  
  console.log('✅ Browser launched');
  
  const page = await browser.newPage();
  
  try {
    // STEP 1: SET COOKIES AND LOGIN
    console.log('\n🔐 STEP 1: Logging into LinkedIn...');
    
    const oneYearFromNow = Math.floor(Date.now() / 1000) + 31536000;
    
    await page.setCookie({
      name: 'li_at',
      value: YOUR_LI_AT_COOKIE,
      domain: '.linkedin.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None',
      expires: oneYearFromNow
    });
    
    // Navigate to feed
    await page.goto('https://www.linkedin.com/feed', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('✅ Logged in successfully');
    await page.screenshot({ path: 'step1-logged-in.png' });
    
    // STEP 2: NAVIGATE TO TARGET PROFILE
    console.log('\n👤 STEP 2: Navigating to target profile...');
    
    const targetProfile = 'https://www.linkedin.com/in/manam-swathi-724832125/';
    await page.goto(targetProfile, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`✅ Profile loaded: ${targetProfile}`);
    await page.screenshot({ path: 'step2-profile-loaded.png' });
    
    // STEP 3: AUTO-SCROLL TO LOAD POSTS (ONLY 3 TIMES)
    console.log('\n📜 STEP 3: Auto-scrolling to load posts (3 times)...');
    
    for (let i = 0; i < 3; i++) {
      console.log(`📜 Scroll ${i + 1}/3`);
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 0.8);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('✅ Auto-scroll completed');
    await page.screenshot({ path: 'step3-scrolled.png' });
    
    // STEP 4: FIND LIKE COUNT BUTTONS (BLUE BUTTON WITH NUMBERS)
    console.log('\n🔍 STEP 4: Finding like count buttons...');
    console.log('Looking for blue buttons with numbers (reactions count)');
    
    const likeCountButtons = await page.evaluate(() => {
      // Find all elements that might be like count buttons
      const selectors = [
        '.feed-shared-social-counts a[href*="reactions"]', // Primary selector
        'button[data-control-name*="likes"]',
        '.social-details-social-counts__count',
        '.social-details-social-counts__reactions-count',
        'a[href*="reactions"] span', // Contains the number
        '.feed-shared-social-action__count' // Another possible selector
      ];
      
      let allButtons = [];
      
      selectors.forEach(selector => {
        const buttons = document.querySelectorAll(selector);
        console.log(`Found ${buttons.length} elements with selector: ${selector}`);
        buttons.forEach(button => {
          allButtons.push(button);
        });
      });
      
      // Remove duplicates
      allButtons = [...new Set(allButtons)];
      
      console.log(`Total unique buttons found: ${allButtons.length}`);
      
      const results = [];
      
      allButtons.forEach((button, index) => {
        const buttonText = button.textContent || '';
        const buttonHTML = button.outerHTML || '';
        
        console.log(`Button ${index}: Text="${buttonText.substring(0, 50)}..."`);
        console.log(`HTML: ${buttonHTML.substring(0, 100)}...`);
        
        // Check if it's a like count button (contains a number and is clickable)
        const hasNumber = /\d+/.test(buttonText);
        const isClickable = button.tagName === 'A' || button.tagName === 'BUTTON' || 
                           button.closest('a') || button.closest('button');
        
        if (hasNumber && isClickable) {
          // Extract the number
          const match = buttonText.match(/\d+/);
          const likesCount = match ? parseInt(match[0]) : 0;
          
          if (likesCount > 0) {
            // Find author name
            let author = 'Unknown';
            const postElement = button.closest('.feed-shared-update-v2, .scaffold-layout__list-item, article');
            if (postElement) {
              const authorElement = postElement.querySelector('.feed-shared-actor__name, .update-components-actor__name');
              if (authorElement) {
                author = authorElement.textContent?.trim() || 'Unknown';
              }
            }
            
            // Mark button for clicking
            button.setAttribute('data-scraper-index', index.toString());
            
            // Highlight the button (blue border)
            button.style.border = '3px solid blue';
            button.style.backgroundColor = 'rgba(0, 115, 177, 0.1)';
            button.style.padding = '5px';
            button.style.borderRadius = '4px';
            
            results.push({ 
              index, 
              likesCount, 
              author,
              element: button.tagName,
              text: buttonText.trim()
            });
            
            console.log(`✅ Found like count button: ${author} - ${likesCount} likes`);
          }
        }
      });
      
      return results;
    });
    
    console.log(`✅ Found ${likeCountButtons.length} like count buttons`);
    await page.screenshot({ path: 'step4-like-buttons-found.png' });
    
    if (likeCountButtons.length === 0) {
      console.log('\n❌ No like count buttons found!');
      console.log('Let me try alternative search...');
      
      // Alternative search
      const alternativeResults = await page.evaluate(() => {
        // Take screenshot of what's visible
        const posts = document.querySelectorAll('.feed-shared-update-v2, article');
        console.log(`Found ${posts.length} posts/articles`);
        
        const results = [];
        
        posts.forEach((post, postIndex) => {
          // Look for any interactive element that might be a like count
          const interactiveElements = post.querySelectorAll('a, button, [role="button"]');
          
          interactiveElements.forEach((element, elemIndex) => {
            const text = element.textContent || '';
            if (/\d+/.test(text)) {
              console.log(`Post ${postIndex}, Element ${elemIndex}: "${text.substring(0, 30)}..."`);
              
              // Check if this looks like a reactions count
              if (text.includes('reaction') || text.match(/^\d+$/) || text.includes('like')) {
                const match = text.match(/\d+/);
                const count = match ? parseInt(match[0]) : 0;
                
                if (count > 0) {
                  // Get author
                  let author = 'Unknown';
                  const authorElement = post.querySelector('.feed-shared-actor__name');
                  if (authorElement) author = authorElement.textContent?.trim() || 'Unknown';
                  
                  results.push({
                    postIndex,
                    elemIndex,
                    author,
                    count,
                    text: text.trim(),
                    elementType: element.tagName
                  });
                  
                  // Highlight
                  element.style.border = '2px solid green';
                  element.style.padding = '3px';
                }
              }
            }
          });
        });
        
        return results;
      });
      
      console.log(`Alternative search found: ${alternativeResults.length} possible buttons`);
      
      if (alternativeResults.length === 0) {
        console.log('❌ Still no buttons found. The profile might not have posts with likes.');
        console.log('Check the screenshot: step4-like-buttons-found.png');
        return;
      } else {
        // Use alternative results
        likeCountButtons.length = 0; // Clear array
        alternativeResults.forEach((result, index) => {
          likeCountButtons.push({
            index,
            likesCount: result.count,
            author: result.author,
            element: result.elementType,
            text: result.text
          });
        });
      }
    }
    
    // STEP 5: CLICK LIKE COUNT BUTTONS AND EXTRACT PROFILES
    console.log('\n🖱️  STEP 5: Clicking like count buttons and extracting profiles...');
    
    const allProfiles = [];
    
    // Process only first 2 buttons for testing
    for (let i = 0; i < Math.min(likeCountButtons.length, 2); i++) {
      const button = likeCountButtons[i];
      console.log(`\n📝 Processing post ${i + 1}: ${button.author} (${button.likesCount} likes)`);
      console.log(`   Button text: "${button.text}"`);
      
      // Scroll to button
      await page.evaluate((index) => {
        const elements = document.querySelectorAll('[data-scraper-index]');
        if (elements[index]) {
          elements[index].scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'center'
          });
          
          // Highlight with animation
          const element = elements[index];
          element.style.border = '3px solid red';
          element.style.boxShadow = '0 0 20px red';
          element.style.transition = 'all 0.3s';
        }
      }, i);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Take screenshot before click
      await page.screenshot({ path: `step5-before-click-${i + 1}.png` });
      
      // Click button - Try multiple methods
      console.log(`   🖱️  Clicking button...`);
      let clicked = false;
      
      // Method 1: Direct click
      try {
        await page.evaluate((index) => {
          const elements = document.querySelectorAll('[data-scraper-index]');
          if (elements[index]) {
            console.log(`Attempting click on element ${index}`);
            elements[index].click();
            return true;
          }
          return false;
        }, i);
        
        clicked = true;
        console.log('   ✅ Clicked via direct method');
      } catch (error) {
        console.log('   ⚠️ Direct click failed, trying alternative...');
      }
      
      // Method 2: Puppeteer click
      if (!clicked) {
        try {
          const elements = await page.$$('[data-scraper-index]');
          if (elements[i]) {
            await elements[i].click();
            clicked = true;
            console.log('   ✅ Clicked via Puppeteer');
          }
        } catch (error) {
          console.log('   ⚠️ Puppeteer click failed');
        }
      }
      
      // Method 3: Mouse events
      if (!clicked) {
        try {
          await page.evaluate((index) => {
            const elements = document.querySelectorAll('[data-scraper-index]');
            if (elements[index]) {
              const rect = elements[index].getBoundingClientRect();
              const x = rect.left + rect.width / 2;
              const y = rect.top + rect.height / 2;
              
              // Create and dispatch mouse events
              const mouseDown = new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true });
              const mouseUp = new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true });
              const clickEvent = new MouseEvent('click', { clientX: x, clientY: y, bubbles: true });
              
              elements[index].dispatchEvent(mouseDown);
              elements[index].dispatchEvent(mouseUp);
              elements[index].dispatchEvent(clickEvent);
              return true;
            }
            return false;
          }, i);
          
          clicked = true;
          console.log('   ✅ Clicked via mouse events');
        } catch (error) {
          console.log('   ⚠️ Mouse events failed');
        }
      }
      
      if (!clicked) {
        console.log('   ❌ Could not click the button');
        continue;
      }
      
      // Wait for modal to appear
      console.log('   ⏳ Waiting for modal popup...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Take screenshot of modal
      await page.screenshot({ path: `step5-modal-${i + 1}.png` });
      
      // Extract profiles from modal
      console.log('   👥 Extracting profiles from modal...');
      const profiles = await page.evaluate((authorName, likesCount) => {
        const profiles = [];
        
        // Look for modal in different ways
        const modalSelectors = [
          '.artdeco-modal',
          '[role="dialog"]',
          '.social-details-reactors-modal',
          '.reactors-modal',
          '.artdeco-modal__content'
        ];
        
        let modal = null;
        for (const selector of modalSelectors) {
          modal = document.querySelector(selector);
          if (modal) {
            console.log(`Found modal with selector: ${selector}`);
            break;
          }
        }
        
        // Also check for modal by looking for profile items
        if (!modal) {
          const profileContainers = document.querySelectorAll('.artdeco-entity-lockup, .reactors__profile-item');
          if (profileContainers.length > 0) {
            console.log(`Found ${profileContainers.length} profile containers without modal`);
            modal = document.body; // Use body as container
          }
        }
        
        if (modal) {
          const profileItems = modal.querySelectorAll('.artdeco-entity-lockup, .reactors__profile-item, li');
          console.log(`Found ${profileItems.length} profile items`);
          
          profileItems.forEach((item, index) => {
            if (index >= 15) return; // Limit to 15
            
            const nameElement = item.querySelector('.artdeco-entity-lockup__title, .reactors__profile-name, h3, span[dir="ltr"]');
            const name = nameElement?.textContent?.trim() || '';
            
            // Skip if no name or generic name
            if (!name || name === 'LinkedIn Member' || name.includes('...')) {
              return;
            }
            
            // Extract profile URL
            let profileUrl = '';
            const linkElement = item.querySelector('a[href*="/in/"]');
            if (linkElement) {
              const href = linkElement.getAttribute('href');
              if (href) {
                profileUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href.split('?')[0]}`;
              }
            }
            
            // Extract headline/job title
            const headlineElement = item.querySelector('.artdeco-entity-lockup__subtitle, .reactors__profile-headline, .entity-result__primary-subtitle');
            const headline = headlineElement?.textContent?.trim() || '';
            
            // Extract company from headline
            let company = '';
            if (headline.includes(' at ')) {
              company = headline.split(' at ')[1]?.trim() || '';
            } else if (headline.includes(' @ ')) {
              company = headline.split(' @ ')[1]?.trim() || '';
            } else if (headline.includes(' · ')) {
              const parts = headline.split(' · ');
              if (parts.length > 1) company = parts[1].trim();
            }
            
            // Extract location
            const locationElement = item.querySelector('.artdeco-entity-lockup__caption, .reactors__profile-distance, .entity-result__secondary-subtitle');
            const location = locationElement?.textContent?.trim() || '';
            
            profiles.push({
              name,
              profileUrl,
              headline,
              company,
              location,
              likedAt: new Date().toISOString(),
              postAuthor: authorName,
              postContent: `Post with ${likesCount} likes`
            });
            
            console.log(`Extracted: ${name} - ${company || 'No company'}`);
          });
          
          // Try to close modal
          const closeSelectors = [
            '.artdeco-modal__dismiss',
            'button[aria-label="Dismiss"]',
            'button[aria-label="Close"]',
            'button.artdeco-button',
            '.artdeco-modal-overlay'
          ];
          
          let modalClosed = false;
          for (const selector of closeSelectors) {
            const closeButton = document.querySelector(selector);
            if (closeButton) {
              closeButton.click();
              modalClosed = true;
              console.log('Closed modal with selector:', selector);
              break;
            }
          }
          
          // If no close button found, press Escape
          if (!modalClosed) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
            console.log('Pressed Escape to close modal');
          }
        } else {
          console.log('No modal found after clicking');
        }
        
        return profiles;
      }, button.author, button.likesCount);
      
      console.log(`   ✅ Extracted ${profiles.length} profiles`);
      
      // Add to total
      allProfiles.push(...profiles);
      
      // Wait before next button
      if (i < Math.min(likeCountButtons.length, 2) - 1) {
        console.log(`   ⏳ Waiting 3 seconds before next button...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // STEP 6: DISPLAY AND SAVE RESULTS
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(60));
    
    console.log(`✅ Total profiles extracted: ${allProfiles.length}`);
    console.log(`✅ From ${Math.min(likeCountButtons.length, 2)} posts`);
    console.log(`✅ Target profile: ${targetProfile}`);
    
    if (allProfiles.length > 0) {
      // Display in table format
      console.log('\n📋 EXTRACTED PROFILES:');
      console.log('='.repeat(100));
      console.log('No. | Name                | Company              | Location      | Profile URL');
      console.log('='.repeat(100));
      
      allProfiles.forEach((profile, i) => {
        const name = profile.name.substring(0, 20).padEnd(20, ' ');
        const company = (profile.company || 'N/A').substring(0, 20).padEnd(20, ' ');
        const location = (profile.location || 'N/A').substring(0, 13).padEnd(13, ' ');
        const url = profile.profileUrl ? '✓ Has URL' : 'No URL';
        
        console.log(`${(i + 1).toString().padEnd(3, ' ')} | ${name} | ${company} | ${location} | ${url}`);
      });
      
      console.log('='.repeat(100));
      
      // Show detailed sample
      console.log('\n🔍 SAMPLE PROFILES (Detailed):');
      allProfiles.slice(0, 3).forEach((profile, i) => {
        console.log(`\n${i + 1}. ${profile.name}`);
        console.log(`   Job Title: ${profile.headline || 'N/A'}`);
        console.log(`   Company: ${profile.company || 'N/A'}`);
        console.log(`   Location: ${profile.location || 'N/A'}`);
        console.log(`   Profile URL: ${profile.profileUrl || 'N/A'}`);
        console.log(`   From post by: ${profile.postAuthor}`);
      });
      
      // Save results to CSV
      console.log('\n💾 Saving results to CSV...');
      const csvContent = generateCSV(allProfiles);
      const fs = await import('fs');
      fs.writeFileSync('scraped-profiles.csv', csvContent);
      console.log('✅ CSV saved: scraped-profiles.csv');
      
      // Save results to JSON
      fs.writeFileSync('scraped-profiles.json', JSON.stringify(allProfiles, null, 2));
      console.log('✅ JSON saved: scraped-profiles.json');
      
      // Also create a simple text summary
      const summary = `LinkedIn Profile Scraper Results\n` +
                     `===============================\n` +
                     `Extracted: ${allProfiles.length} profiles\n` +
                     `From: ${targetProfile}\n` +
                     `Date: ${new Date().toLocaleString()}\n\n` +
                     allProfiles.map((p, i) => 
                       `${i + 1}. ${p.name}\n   ${p.company || 'N/A'} - ${p.location || 'N/A'}\n`
                     ).join('\n');
      
      fs.writeFileSync('scraped-summary.txt', summary);
      console.log('✅ Summary saved: scraped-summary.txt');
    } else {
      console.log('\n❌ No profiles were extracted.');
      console.log('Check the screenshots to see what happened.');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SCRAPING COMPLETED!');
    console.log('='.repeat(60));
    console.log('\n📁 Generated files:');
    console.log('   - scraped-profiles.csv (Excel/Google Sheets format)');
    console.log('   - scraped-profiles.json (Raw data)');
    console.log('   - scraped-summary.txt (Text summary)');
    console.log('   - step*.png (Screenshots for debugging)');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    console.log('\n🔍 Browser will stay open for inspection...');
    console.log('Check the screenshots and data files.');
    console.log('Press Ctrl+C in terminal to close when ready.');
    
    // Don't auto-close, let user inspect
    // await browser.close();
  }
}

// Helper function to generate CSV
function generateCSV(data) {
  if (!data.length) return '';
  
  const headers = ['Name', 'Profile URL', 'Job Title', 'Company', 'Location', 'Liked At', 'Post Author'];
  
  const csvRows = [];
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = [
      `"${(row.name || '').replace(/"/g, '""')}"`,
      `"${(row.profileUrl || '').replace(/"/g, '""')}"`,
      `"${(row.headline || '').replace(/"/g, '""')}"`,
      `"${(row.company || '').replace(/"/g, '""')}"`,
      `"${(row.location || '').replace(/"/g, '""')}"`,
      `"${(row.likedAt || '').replace(/"/g, '""')}"`,
      `"${(row.postAuthor || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Run the test
testFullScraper();