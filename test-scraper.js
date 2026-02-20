const LinkedInScraper = require('./lib/puppeteer-scraper').default;

async function test() {
  const scraper = new LinkedInScraper();
  
  try {
    // Replace with YOUR actual cookie
    const profileData = {
      name: 'Your Name',
      li_at: 'AQEDAWCbfhcC9KAoAAABnEfNJOUAAAGca9mo5VYAJRdrHcATQEvRgfKq8gYQLVwFPTQoyNvD4HZJkKJ0QzJO6Isqr9r3v9L1ht_AR0IniqQdT-uUg37qYukxwHiK41wJ7UMwv1pDIC6A_hnXVkD2nJtB', // Get fresh one!
      jsessionid: 'ajax:1234567890', // Optional
      bcookie: 'v=2&...' // Optional
    };
    
    console.log('🚀 Starting test...');
    console.log(`Using cookie: ${profileData.li_at.substring(0, 20)}...`);
    
    // Test initialization
    console.log('\n1️⃣  Initializing browser...');
    await scraper.initialize(profileData, 'https://www.linkedin.com/in/manam-swathi-724832125/');
    console.log('✅ Browser initialized!');
    
    // Wait a bit for page to settle
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test auto-scroll
    console.log('\n2️⃣  Testing auto-scroll...');
    await scraper.autoScrollToLoadPosts(3);
    console.log('✅ Auto-scroll test completed');
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test finding like buttons
    console.log('\n3️⃣  Testing like button finding...');
    const buttons = await scraper.findLikeButtons();
    console.log(`✅ Found ${buttons.length} like buttons`);
    
    if (buttons.length > 0) {
      console.log('\n📋 Like buttons found:');
      buttons.forEach((btn, i) => {
        console.log(`   ${i + 1}. ${btn.author} - ${btn.likesCount} likes`);
      });
      
      // Test clicking first button
      console.log('\n4️⃣  Testing clicking first like button...');
      await scraper.clickLikeButton(0);
      console.log('✅ Click test completed');
      
      // Wait for modal
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test extracting profiles
      console.log('\n5️⃣  Testing profile extraction...');
      const profiles = await scraper.extractProfilesFromModal();
      console.log(`✅ Extracted ${profiles.length} profiles`);
      
      if (profiles.length > 0) {
        console.log('\n📋 Sample profiles extracted:');
        profiles.slice(0, 3).forEach((profile, i) => {
          console.log(`   ${i + 1}. ${profile.name}`);
          console.log(`      🏢 ${profile.company || 'No company'}`);
          console.log(`      📍 ${profile.location || 'No location'}`);
        });
      }
    } else {
      console.log('⚠️ No like buttons found to test');
    }
    
    // Test full scraping
    console.log('\n6️⃣  Testing full scrape function...');
    const result = await scraper.scrapeProfileActivity('https://www.linkedin.com/in/manam-swathi-724832125/', 5);
    
    if (result.success) {
      console.log(`✅ Full scrape successful!`);
      console.log(`📊 Extracted ${result.data.likes.length} profiles`);
      console.log(`📋 Found ${result.data.posts.length} posts`);
    } else {
      console.log(`❌ Full scrape failed: ${result.error}`);
    }
    
    // Close browser
    console.log('\n7️⃣  Closing browser...');
    await scraper.close();
    console.log('✅ Browser closed');
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    console.log('='.repeat(60));
    
    try {
      await scraper.close();
    } catch (closeError) {
      console.error('Error closing browser:', closeError);
    }
    
    process.exit(1);
  }
}

// Run test
console.log('Starting LinkedIn Scraper Test...');
console.log('Make sure you have a valid li_at cookie!');
console.log('='.repeat(60));

test();