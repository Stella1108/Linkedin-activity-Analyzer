import puppeteer, { Browser, Page, Cookie } from 'puppeteer';
import { LinkedInProfileData, LikeData, CommentData, PostData, ScrapeResult } from './types';

export class LinkedInScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private profileData: LinkedInProfileData | null = null;
  private browserLaunched = false;
  private isInitialized = false;

  // Human-like delay
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Random human-like delay
  private async humanLikeDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await this.delay(delay);
  }

  // Simulate human behavior
  private async simulateHumanBehavior(page: Page): Promise<void> {
    console.log('👤 Simulating human behavior...');
    
    // Random mouse movements
    const viewport = await page.viewport();
    const maxX = viewport?.width || 1920;
    const maxY = viewport?.height || 1080;
    
    await page.mouse.move(
      Math.random() * maxX,
      Math.random() * maxY,
      { steps: 10 }
    );
    
    // Random scroll
    await page.evaluate(() => {
      window.scrollBy({
        top: Math.random() * 500 - 250,
        behavior: 'smooth'
      });
    });
    
    await this.humanLikeDelay(1000, 3000);
  }

  // Scroll page slowly to trigger lazy loading
  private async slowScroll(page: Page, scrollDistance: number = 300, delayMs: number = 200): Promise<void> {
    console.log(`📜 Scrolling page to load content...`);
    
    await page.evaluate(async (distance, delay) => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const scrollHeight = document.body.scrollHeight;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, delay);
      });
    }, scrollDistance, delayMs);
  }

  // Check if LinkedIn is logged in
  private async isLoggedIn(page: Page): Promise<boolean> {
    try {
      await this.delay(3000); // Wait for page to stabilize
      const currentUrl = await page.url();
      
      // If URL contains login/signin, not logged in
      if (currentUrl.includes('login') || currentUrl.includes('signin')) {
        return false;
      }
      
      // Check for login elements on page
      const hasLoginElements = await page.evaluate(() => {
        const loginSelectors = [
          'input[name="session_key"]',
          'input[name="session_password"]',
          'button[type="submit"]',
          '.login-form',
          '.sign-in-form',
          'h1:contains("Sign in")',
          'h1:contains("Login")'
        ];
        
        return loginSelectors.some(selector => {
          const elements = document.querySelectorAll(selector);
          return elements.length > 0;
        });
      });
      
      return !hasLoginElements;
    } catch (error) {
      console.log('⚠️ Error checking login status:', error);
      return false;
    }
  }

  // Wait for manual login
  private async waitForManualLogin(page: Page, timeoutMinutes: number = 10): Promise<boolean> {
    console.log('\n🔐 WAITING FOR MANUAL LOGIN...');
    console.log('   Please log into LinkedIn manually in the browser');
    console.log('   This script will wait until you are logged in');
    
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < timeoutMs) {
      attempts++;
      
      try {
        await this.delay(5000); // Wait 5 seconds between checks
        
        const loggedIn = await this.isLoggedIn(page);
        
        if (loggedIn) {
          console.log('✅ User is logged in!');
          return true;
        }
        
        console.log(`⏳ Waiting for login... (attempt ${attempts})`);
        console.log('💡 Instructions:');
        console.log('   1. Log into LinkedIn in the browser window');
        console.log('   2. Stay on LinkedIn feed or any LinkedIn page');
        console.log('   3. The script will detect when you are logged in');
        
        // Wait before next check
        await this.delay(15000); // Check every 15 seconds
        
      } catch (error) {
        console.log(`⚠️ Error checking login status: ${error}`);
        await this.delay(10000);
      }
    }
    
    console.log('❌ Login timeout. Please log into LinkedIn manually and try again.');
    return false;
  }

  async initialize(profileData: LinkedInProfileData): Promise<{ browser: Browser; page: Page }> {
    this.profileData = profileData;
    
    const cookies: Cookie[] = [
      {
        name: 'li_at',
        value: profileData.li_at,
        domain: '.linkedin.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'None'
      } as Cookie
    ];

    if (profileData.jsessionid) {
      cookies.push({
        name: 'JSESSIONID',
        value: profileData.jsessionid,
        domain: '.linkedin.com',
        path: '/',
        secure: true,
        httpOnly: true,
      } as Cookie);
    }

    if (profileData.bcookie) {
      cookies.push({
        name: 'bcookie',
        value: profileData.bcookie,
        domain: '.linkedin.com',
        path: '/',
        secure: true,
        httpOnly: true,
      } as Cookie);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🚀 LAUNCHING LINKEDIN SCRAPER');
    console.log('='.repeat(60));
    console.log('\n📋 INSTRUCTIONS:');
    console.log('   1. A Chrome browser will open automatically');
    console.log('   2. LinkedIn will open with your session cookies');
    console.log('   3. If not logged in, please log in manually');
    console.log('   4. Keep the browser open while scraping');
    console.log('   5. Watch the browser for all actions');
    console.log('\n');

    const launchOptions: any = {
      headless: false, // Always visible
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--start-maximized',
        '--disable-infobars',
        '--disable-notifications',
        '--disable-blink-features=AutomationControlled',
        '--remote-debugging-port=9222',
        '--window-size=1920,1080',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      defaultViewport: null,
      timeout: 120000, // 2 minutes timeout
      ignoreHTTPSErrors: true
    };

    try {
      this.browser = await puppeteer.launch(launchOptions);
      this.browserLaunched = true;

      const pages = await this.browser.pages();
      this.page = pages[0] || await this.browser.newPage();
      
      // Set viewport
      await this.page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
      });
      
      // Set user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Remove automation detection
      await this.page.evaluateOnNewDocument(() => {
        // Overwrite the navigator properties
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false
        });
        
        // Overwrite the plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        // Overwrite the languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });
        
        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        (window.navigator as any).permissions.query = (parameters: any) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission } as PermissionStatus) :
            originalQuery(parameters)
        );
      });
      
      // Set cookies if provided
      if (cookies.length > 0) {
        console.log(`🍪 Setting ${cookies.length} cookies...`);
        try {
          await this.page.setCookie(...cookies);
          console.log('✅ Cookies set successfully');
        } catch (error) {
          console.warn('⚠️ Error setting cookies:', error);
        }
      }
      
      // Navigate to LinkedIn with longer timeout
      console.log('🌐 Navigating to LinkedIn feed...');
      await this.page.goto('https://www.linkedin.com/feed', {
        waitUntil: 'networkidle0',
        timeout: 120000
      });
      
      await this.delay(8000); // Increased wait time
      
      // Check if logged in
      const loggedIn = await this.isLoggedIn(this.page);
      if (!loggedIn) {
        console.log('⚠️ Not logged in with cookies. Please log in manually in the browser window.');
        console.log('📢 IMPORTANT: Keep the browser window visible and focused');
        const loginSuccess = await this.waitForManualLogin(this.page);
        if (!loginSuccess) {
          throw new Error('Manual login failed or timed out');
        }
      } else {
        console.log('✅ Successfully logged into LinkedIn!');
      }
      
      // Bring browser to front (if possible)
      try {
        await this.page.bringToFront();
      } catch (error) {
        console.log('⚠️ Could not bring browser to front');
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ BROWSER IS READY FOR SCRAPING');
      console.log('='.repeat(60));
      console.log('\n📋 WHAT WILL HAPPEN IN THE BROWSER:');
      console.log('   1. Each profile/post will open in a NEW TAB');
      console.log('   2. You can watch the browser navigate and scrape');
      console.log('   3. Tabs will close automatically after scraping');
      console.log('   4. The main browser window will remain open');
      console.log('\n👁️  Keep the browser window visible to watch the process!');
      console.log('\n');
      
      this.isInitialized = true;
      return { browser: this.browser, page: this.page };
      
    } catch (error: any) {
      console.error('\n❌ Failed to initialize browser:', error.message);
      console.log('\n🔧 TROUBLESHOOTING:');
      console.log('   1. Make sure Chrome/Firefox is installed');
      console.log('   2. Close all browser instances and try again');
      console.log('   3. Check your internet connection');
      console.log('   4. Make sure LinkedIn is accessible in your region');
      console.log('\n');
      await this.close();
      throw error;
    }
  }

  // Navigate to profile/post in NEW TAB with better loading
  private async navigateInNewTab(url: string): Promise<{success: boolean, page: Page | null, message: string}> {
    if (!this.browser) {
      return { success: false, page: null, message: 'Browser not initialized' };
    }

    try {
      let formattedUrl = url.trim();
      
      // Format URL
      if (!formattedUrl.startsWith('http')) {
        formattedUrl = 'https://' + formattedUrl;
      }
      if (formattedUrl.includes('linkedin.com') && !formattedUrl.includes('www.')) {
        formattedUrl = formattedUrl.replace('linkedin.com', 'www.linkedin.com');
      }
      
      // Ensure it's a valid LinkedIn URL
      if (!formattedUrl.includes('linkedin.com')) {
        return { success: false, page: null, message: 'Invalid LinkedIn URL' };
      }

      console.log(`🌐 Opening NEW TAB: ${formattedUrl}`);
      console.log('👁️  Watch the browser - new tab will open shortly...');
      
      // Create new tab
      const newPage = await this.browser.newPage();
      
      // Configure new page
      await newPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Remove automation detection
      await newPage.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false
        });
      });
      
      // Set viewport
      await newPage.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
      });
      
      // Navigate to URL with longer timeout
      console.log(`⏳ Navigating to: ${formattedUrl} (this may take up to 2 minutes)...`);
      await newPage.goto(formattedUrl, {
        waitUntil: 'networkidle0',
        timeout: 120000
      });
      
      // Wait for page to load completely
      console.log('⏳ Waiting for page to fully load...');
      await this.delay(8000);
      
      // Check if we need to wait for additional content
      try {
        await newPage.waitForSelector('body', { timeout: 30000 });
      } catch (error) {
        console.log('⚠️ Page took longer than expected to load');
      }
      
      // Bring the new tab to front so user can see it
      await newPage.bringToFront();
      
      // Check if page exists
      const pageExists = await newPage.evaluate(() => {
        const errorElements = document.querySelectorAll('h1, h2, h3, .error-container');
        for (const element of errorElements) {
          const text = element.textContent?.toLowerCase() || '';
          if (text.includes('page not found') || 
              text.includes('profile not found') ||
              text.includes('doesn\'t exist') ||
              text.includes('could not find')) {
            return false;
          }
        }
        return true;
      });
      
      if (!pageExists) {
        console.log('❌ Page not found');
        await newPage.close();
        return { success: false, page: null, message: 'Page not found' };
      }
      
      console.log('✅ Page loaded successfully');
      return { success: true, page: newPage, message: 'Page opened successfully' };
      
    } catch (error: any) {
      console.error('❌ Error opening page:', error.message);
      return { success: false, page: null, message: `Failed to open page: ${error.message}` };
    }
  }

  // Find and extract posts from profile with better selectors
  private async extractPosts(page: Page): Promise<PostData[]> {
    console.log('🔍 Searching for posts with advanced selectors...');
    
    // First, try to find the "Activity" section
    await page.evaluate(() => {
      const activitySection = document.querySelector('section[data-section="activity"]');
      if (activitySection) {
        activitySection.scrollIntoView({ behavior: 'smooth' });
      }
    });
    
    await this.delay(3000);
    
    return await page.evaluate((): PostData[] => {
      const posts: PostData[] = [];
      
      // Multiple selectors for posts
      const postSelectors = [
        'article.scaffold-layout__list-item',
        'div.feed-shared-update-v2',
        'section.scaffold-layout__main .occludable-update',
        'div.update-components-actor',
        'li.profile-creator-shared-feed-update'
      ];
      
      let postElements: Element[] = [];
      
      // Try each selector
      for (const selector of postSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
          console.log(`Found ${elements.length} posts with selector: ${selector}`);
          postElements = elements;
          break;
        }
      }
      
      // If no posts found with specific selectors, try more generic
      if (postElements.length === 0) {
        postElements = Array.from(document.querySelectorAll('article, div[data-urn]'));
      }
      
      console.log(`Total posts found: ${postElements.length}`);
      
      postElements.forEach((element, index) => {
        if (index > 4) return; // Limit to first 5 posts
        
        // Extract author info
        let author = 'Unknown';
        let authorProfileUrl = '';
        
        const authorSelectors = [
          '.feed-shared-actor__name span',
          '.update-components-actor__name',
          '.feed-shared-actor__title',
          'span[aria-hidden="true"]'
        ];
        
        for (const selector of authorSelectors) {
          const authorElement = element.querySelector(selector);
          if (authorElement) {
            author = authorElement.textContent?.trim() || 'Unknown';
            break;
          }
        }
        
        // Find author link
        const authorLinkSelectors = [
          'a[data-control-name="actor_profile"]',
          'a.update-components-actor__container',
          'a.feed-shared-actor__avatar-link'
        ];
        
        for (const selector of authorLinkSelectors) {
          const linkElement = element.querySelector(selector);
          if (linkElement) {
            const href = linkElement.getAttribute('href');
            if (href) {
              authorProfileUrl = `https://www.linkedin.com${href.split('?')[0]}`;
              break;
            }
          }
        }
        
        // Extract content
        let content = '';
        const contentSelectors = [
          '.feed-shared-update-v2__description span',
          '.update-components-text span',
          'div.feed-shared-text-view',
          'div.update-components-text'
        ];
        
        for (const selector of contentSelectors) {
          const contentElement = element.querySelector(selector);
          if (contentElement) {
            content = contentElement.textContent?.trim() || '';
            break;
          }
        }
        
        // Find post link
        let postUrl = '';
        const timeElement = element.querySelector('time');
        if (timeElement?.parentElement?.tagName === 'A') {
          const href = timeElement.parentElement.getAttribute('href');
          if (href) postUrl = `https://www.linkedin.com${href}`;
        }
        
        // Try alternative ways to find post URL
        if (!postUrl) {
          const postLinkElement = element.querySelector('a[data-control-name="view_update"]');
          if (postLinkElement) {
            const href = postLinkElement.getAttribute('href');
            if (href) postUrl = `https://www.linkedin.com${href}`;
          }
        }
        
        // Extract engagement stats
        let likesCount = 0;
        let commentsCount = 0;
        
        const socialSelectors = [
          '.social-details-social-counts',
          '.feed-shared-social-actions',
          'div.update-components-engagement'
        ];
        
        for (const selector of socialSelectors) {
          const socialActions = element.querySelector(selector);
          if (socialActions) {
            const text = socialActions.textContent || '';
            
            // Extract likes
            const likesMatch = text.match(/(\d+)\s*(like|reaction)/i);
            if (likesMatch) {
              likesCount = parseInt(likesMatch[1]);
            } else {
              // Try to find likes button
              const likesButton = element.querySelector('button[data-control-name*="like"] span');
              if (likesButton) {
                const likesText = likesButton.textContent || '';
                const numMatch = likesText.match(/\d+/);
                if (numMatch) likesCount = parseInt(numMatch[0]);
              }
            }
            
            // Extract comments
            const commentsMatch = text.match(/(\d+)\s*comment/i);
            if (commentsMatch) {
              commentsCount = parseInt(commentsMatch[1]);
            } else {
              // Try to find comments button
              const commentsButton = element.querySelector('button[data-control-name*="comment"] span');
              if (commentsButton) {
                const commentsText = commentsButton.textContent || '';
                const numMatch = commentsText.match(/\d+/);
                if (numMatch) commentsCount = parseInt(numMatch[0]);
              }
            }
            
            break;
          }
        }
        
        if (author !== 'Unknown' && content) {
          posts.push({
            author,
            authorProfileUrl,
            content: content.length > 300 ? content.substring(0, 300) + '...' : content,
            postUrl,
            postedAt: new Date().toISOString(),
            likesCount,
            commentsCount
          });
        }
      });
      
      return posts;
    });
  }

  // Scrape detailed profile information
  private async scrapeProfileDetails(profileUrl: string): Promise<{
    name: string;
    headline: string;
    company: string;
    location: string;
    profileUrl: string;
  }> {
    if (!this.browser) {
      return {
        name: 'Unknown',
        headline: '',
        company: '',
        location: '',
        profileUrl: profileUrl
      };
    }

    let profilePage: Page | null = null;

    try {
      console.log(`👤 Opening profile for details: ${profileUrl}`);
      
      // Navigate to profile
      const navResult = await this.navigateInNewTab(profileUrl);
      if (!navResult.success || !navResult.page) {
        throw new Error('Failed to open profile');
      }
      
      profilePage = navResult.page;
      await this.delay(5000);
      
      // Extract profile details
      const profileDetails = await profilePage.evaluate(() => {
        // Get name
        let name = 'Unknown';
        const nameElements = [
          'h1.text-heading-xlarge',
          'h1.pv-top-card-section__name',
          'h1.inline',
          '.pv-top-card-section__name'
        ];
        
        for (const selector of nameElements) {
          const element = document.querySelector(selector);
          if (element) {
            name = element.textContent?.trim() || 'Unknown';
            break;
          }
        }
        
        // Get headline (job title)
        let headline = '';
        const headlineElements = [
          '.text-body-medium',
          '.pv-top-card-section__headline',
          '.inline-show-more-text'
        ];
        
        for (const selector of headlineElements) {
          const element = document.querySelector(selector);
          if (element) {
            headline = element.textContent?.trim() || '';
            break;
          }
        }
        
        // Extract company from headline
        let company = '';
        if (headline.includes(' at ')) {
          company = headline.split(' at ')[1]?.trim() || '';
        } else if (headline.includes(' @ ')) {
          company = headline.split(' @ ')[1]?.trim() || '';
        } else if (headline.includes(', ')) {
          const parts = headline.split(', ');
          if (parts.length > 1) {
            company = parts[1]?.trim() || '';
          }
        }
        
        // Get location
        let location = '';
        const locationElements = [
          '.pv-top-card-section__location',
          '.text-body-small',
          'span[data-test-location]'
        ];
        
        for (const selector of locationElements) {
          const element = document.querySelector(selector);
          if (element) {
            location = element.textContent?.trim() || '';
            break;
          }
        }
        
        return {
          name,
          headline,
          company,
          location,
          profileUrl: window.location.href
        };
      });
      
      await profilePage.close();
      return profileDetails;
      
    } catch (error) {
      console.error('❌ Error scraping profile details:', error);
      if (profilePage && !profilePage.isClosed()) {
        await profilePage.close();
      }
      
      return {
        name: 'Unknown',
        headline: '',
        company: '',
        location: '',
        profileUrl: profileUrl
      };
    }
  }

  async scrapeProfileActivity(profileUrl: string): Promise<ScrapeResult> {
    if (!this.browser || !this.isInitialized) {
      throw new Error('Scraper not initialized. Call initialize() first.');
    }

    let profilePage: Page | null = null;

    try {
      console.log('\n' + '='.repeat(60));
      console.log('👨‍💼 STARTING PROFILE SCRAPING');
      console.log('='.repeat(60));
      console.log(`📊 Profile URL: ${profileUrl}`);
      
      // Step 1: Open profile in NEW TAB
      console.log('\n📋 Step 1: Opening profile in new tab...');
      console.log('👁️  Watch the browser - new tab will open...');
      const navResult = await this.navigateInNewTab(profileUrl);
      
      if (!navResult.success || !navResult.page) {
        console.log(`❌ Failed: ${navResult.message}`);
        return {
          success: false,
          error: navResult.message,
          data: {
            likes: [],
            comments: [],
            profileUrl,
            scrapedAt: new Date().toISOString()
          }
        };
      }
      
      profilePage = navResult.page;
      console.log('✅ Profile opened successfully in new tab');
      console.log('👁️  You can see the profile page in the browser');
      
      // Step 2: Check if logged in
      console.log('\n📋 Step 2: Checking login status...');
      const isLoggedIn = await this.isLoggedIn(profilePage);
      if (!isLoggedIn) {
        await profilePage.close();
        return {
          success: false,
          error: 'Not logged into LinkedIn. Please check cookies.',
          data: {
            likes: [],
            comments: [],
            profileUrl,
            scrapedAt: new Date().toISOString()
          }
        };
      }
      
      console.log('✅ Successfully logged in');

      // Step 3: Human-like behavior
      console.log('\n📋 Step 3: Simulating human behavior...');
      console.log('👁️  Watch the browser - simulating human actions...');
      await this.simulateHumanBehavior(profilePage);

      // Step 4: Scroll through profile to load activities
      console.log('\n📋 Step 4: Loading profile activities...');
      console.log('👁️  Watch the browser - scrolling to load content...');
      await this.slowScroll(profilePage, 300, 300);
      
      // Wait for content to load
      await this.delay(5000);

      // Step 5: Extract posts
      console.log('\n📋 Step 5: Extracting posts...');
      console.log('🔍 Searching for posts on the profile...');
      const posts = await this.extractPosts(profilePage);
      const results: ScrapeResult = {
        success: true,
        data: {
          likes: [],
          comments: [],
          profileUrl,
          scrapedAt: new Date().toISOString()
        },
        message: 'Successfully scraped profile activities'
      };

      // If we have posts, scrape the first one
      if (posts.length > 0) {
        const firstPost = posts[0];
        results.data.post = firstPost;
        
        console.log(`📊 Post found: "${firstPost.author}"`);
        console.log(`   👍 Likes: ${firstPost.likesCount}`);
        console.log(`   💬 Comments: ${firstPost.commentsCount}`);
        
        // Scrape likes for the first post
        if (firstPost.likesCount > 0 && firstPost.postUrl) {
          console.log('\n📋 Step 6: Scraping likes with detailed profiles...');
          console.log('👁️  Opening post to scrape likes...');
          const likes = await this.scrapePostLikes(firstPost.postUrl);
          results.data.likes = likes;
          console.log(`✅ Found ${likes.length} likes`);
        }

        // Scrape comments for the first post
        if (firstPost.commentsCount > 0 && firstPost.postUrl) {
          console.log('\n📋 Step 7: Scraping comments...');
          console.log('👁️  Opening post to scrape comments...');
          const comments = await this.scrapePostComments(firstPost.postUrl);
          results.data.comments = comments;
          console.log(`✅ Found ${comments.length} comments`);
        }
      } else {
        console.log('ℹ️ No recent posts found on this profile');
      }

      // Step 8: Close profile tab
      console.log('\n📋 Step 8: Closing profile tab...');
      console.log('👁️  Watch the browser - profile tab will close...');
      await profilePage.close();
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 PROFILE SCRAPING COMPLETE');
      console.log('='.repeat(60));
      console.log(`✅ Successfully scraped data from: ${profileUrl}`);
      console.log(`📊 Results: ${results.data.likes.length} likes, ${results.data.comments.length} comments`);
      
      return results;

    } catch (error: any) {
      console.error('\n❌ ERROR IN SCRAPING PROCESS:', error.message);
      
      // Close profile tab on error
      if (profilePage && !profilePage.isClosed()) {
        try {
          await profilePage.close();
          console.log('✅ Closed profile tab');
        } catch (e) {
          console.log('⚠️ Error closing tab:', e);
        }
      }
      
      return {
        success: false,
        error: error.message,
        data: {
          likes: [],
          comments: [],
          profileUrl,
          scrapedAt: new Date().toISOString()
        }
      };
    }
  }

  async scrapePost(postUrl: string): Promise<ScrapeResult> {
    if (!this.browser || !this.isInitialized) {
      throw new Error('Scraper not initialized. Call initialize() first.');
    }

    let postPage: Page | null = null;

    try {
      console.log('\n' + '='.repeat(60));
      console.log('📝 STARTING POST SCRAPING');
      console.log('='.repeat(60));
      console.log(`📊 Post URL: ${postUrl}`);
      
      // Step 1: Open post in NEW TAB
      console.log('\n📋 Step 1: Opening post in new tab...');
      console.log('👁️  Watch the browser - new tab will open...');
      const navResult = await this.navigateInNewTab(postUrl);
      
      if (!navResult.success || !navResult.page) {
        console.log(`❌ Failed: ${navResult.message}`);
        return {
          success: false,
          error: navResult.message,
          data: {
            likes: [],
            comments: [],
            profileUrl: postUrl,
            scrapedAt: new Date().toISOString()
          }
        };
      }
      
      postPage = navResult.page;
      console.log('✅ Post opened successfully in new tab');
      console.log('👁️  You can see the post page in the browser');
      
      // Step 2: Check if logged in
      console.log('\n📋 Step 2: Checking login status...');
      const isLoggedIn = await this.isLoggedIn(postPage);
      if (!isLoggedIn) {
        await postPage.close();
        return {
          success: false,
          error: 'Not logged into LinkedIn. Please check cookies.',
          data: {
            likes: [],
            comments: [],
            profileUrl: postUrl,
            scrapedAt: new Date().toISOString()
          }
        };
      }
      
      console.log('✅ Successfully logged in');

      // Step 3: Human-like behavior
      console.log('\n📋 Step 3: Simulating human behavior...');
      console.log('👁️  Watch the browser - simulating human actions...');
      await this.simulateHumanBehavior(postPage);

      // Step 4: Extract post data
      console.log('\n📋 Step 4: Extracting post data...');
      console.log('🔍 Extracting post content and engagement...');
      
      // Scroll to ensure all content is loaded
      await this.slowScroll(postPage, 200, 300);
      await this.delay(3000);
      
      const postData = await postPage.evaluate((): PostData | null => {
        // Try multiple selectors for post content
        const articleSelectors = [
          'article.feed-shared-update-v2',
          'div.update-components-update-v2',
          'div.scaffold-layout__main article',
          'div[data-urn*="activity"]',
          'article.scaffold-layout__list-item'
        ];

        let article: HTMLElement | null = null;
        for (const selector of articleSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            article = el as HTMLElement;
            console.log(`Found article with selector: ${selector}`);
            break;
          }
        }

        if (!article) {
          console.log('No article found with specific selectors');
          return null;
        }

        // Extract author info with multiple selectors
        let author = 'Unknown';
        let authorProfileUrl = '';
        
        const authorSelectors = [
          '.feed-shared-actor__name span',
          '.update-components-actor__name',
          'span[aria-hidden="true"]',
          'a[data-control-name="actor_profile"] span'
        ];
        
        for (const selector of authorSelectors) {
          const authorElement = article.querySelector(selector);
          if (authorElement) {
            author = authorElement.textContent?.trim() || 'Unknown';
            break;
          }
        }

        // Find author link
        const authorLinkSelectors = [
          'a[data-control-name="actor_profile"]',
          '.feed-shared-actor__avatar-link',
          '.update-components-actor__container'
        ];
        
        for (const selector of authorLinkSelectors) {
          const authorLink = article.querySelector(selector);
          if (authorLink) {
            const href = authorLink.getAttribute('href');
            if (href) {
              authorProfileUrl = `https://www.linkedin.com${href.split('?')[0]}`;
              break;
            }
          }
        }

        // Extract content
        let content = '';
        const contentSelectors = [
          '.feed-shared-update-v2__description',
          '.update-components-text',
          '.feed-shared-text-view',
          'div[dir="ltr"]'
        ];
        
        for (const selector of contentSelectors) {
          const contentElement = article.querySelector(selector);
          if (contentElement) {
            content = contentElement.textContent?.trim() || '';
            break;
          }
        }

        // Extract likes and comments count
        let likesCount = 0;
        let commentsCount = 0;

        const socialSelectors = [
          '.social-details-social-counts',
          '.feed-shared-social-actions',
          '.update-components-engagement'
        ];
        
        for (const selector of socialSelectors) {
          const socialActions = article.querySelector(selector);
          if (socialActions) {
            const text = socialActions.textContent || '';
            
            // Extract likes
            const likesMatch = text.match(/(\d+)\s*(like|reaction)/i);
            if (likesMatch) {
              likesCount = parseInt(likesMatch[1]);
            }
            
            // Extract comments
            const commentsMatch = text.match(/(\d+)\s*comment/i);
            if (commentsMatch) {
              commentsCount = parseInt(commentsMatch[1]);
            }
            
            break;
          }
        }

        // If no likes/comments found in text, try button spans
        if (likesCount === 0) {
          const likesButton = article.querySelector('button[data-control-name*="like"] span');
          if (likesButton) {
            const likesText = likesButton.textContent || '';
            const numMatch = likesText.match(/\d+/);
            if (numMatch) likesCount = parseInt(numMatch[0]);
          }
        }
        
        if (commentsCount === 0) {
          const commentsButton = article.querySelector('button[data-control-name*="comment"] span');
          if (commentsButton) {
            const commentsText = commentsButton.textContent || '';
            const numMatch = commentsText.match(/\d+/);
            if (numMatch) commentsCount = parseInt(numMatch[0]);
          }
        }

        return {
          author,
          authorProfileUrl,
          content,
          postUrl: window.location.href,
          postedAt: new Date().toISOString(),
          likesCount,
          commentsCount
        };
      });

      if (!postData) {
        await postPage.close();
        return {
          success: false,
          error: 'Could not find post content',
          data: {
            likes: [],
            comments: [],
            profileUrl: postUrl,
            scrapedAt: new Date().toISOString()
          }
        };
      }

      console.log(`📊 Post details:`);
      console.log(`   👤 Author: ${postData.author}`);
      console.log(`   👍 Likes: ${postData.likesCount}`);
      console.log(`   💬 Comments: ${postData.commentsCount}`);

      const result: ScrapeResult = {
        success: true,
        data: {
          post: postData,
          likes: [],
          comments: [],
          profileUrl: postUrl,
          scrapedAt: new Date().toISOString()
        },
        message: 'Successfully scraped post'
      };

      // Scrape likes if available
      if (postData.likesCount > 0) {
        console.log('\n📋 Step 5: Scraping likes with detailed profiles...');
        console.log('👁️  Opening likes modal and scraping profiles...');
        const likes = await this.scrapePostLikes(postUrl);
        result.data.likes = likes;
        console.log(`✅ Found ${likes.length} likes`);
      }

      // Scrape comments if available
      if (postData.commentsCount > 0) {
        console.log('\n📋 Step 6: Scraping comments...');
        console.log('👁️  Loading comments...');
        const comments = await this.scrapePostComments(postUrl);
        result.data.comments = comments;
        console.log(`✅ Found ${comments.length} comments`);
      }

      // Step 7: Close post tab
      console.log('\n📋 Step 7: Closing post tab...');
      console.log('👁️  Watch the browser - post tab will close...');
      await postPage.close();
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 POST SCRAPING COMPLETE');
      console.log('='.repeat(60));
      console.log(`✅ Successfully scraped data from: ${postUrl}`);
      console.log(`📊 Results: ${result.data.likes.length} likes, ${result.data.comments.length} comments`);
      
      return result;

    } catch (error: any) {
      console.error('\n❌ ERROR IN SCRAPING PROCESS:', error.message);
      
      // Close post tab on error
      if (postPage && !postPage.isClosed()) {
        try {
          await postPage.close();
          console.log('✅ Closed post tab');
        } catch (e) {
          console.log('⚠️ Error closing tab:', e);
        }
      }
      
      return {
        success: false,
        error: error.message,
        data: {
          likes: [],
          comments: [],
          profileUrl: postUrl,
          scrapedAt: new Date().toISOString()
        }
      };
    }
  }

  private async scrapePostLikes(postUrl: string): Promise<LikeData[]> {
    if (!this.browser) return [];

    let likesPage: Page | null = null;

    try {
      // Open post in new tab for likes
      const navResult = await this.navigateInNewTab(postUrl);
      if (!navResult.success || !navResult.page) {
        return [];
      }
      
      likesPage = navResult.page;
      console.log('👁️  Watching likes extraction...');
      await this.delay(5000);
      
      // Scroll to ensure likes button is visible
      await this.slowScroll(likesPage, 200, 200);
      await this.delay(3000);

      // Try to click on likes count to open modal
      console.log('🔍 Looking for likes button...');
      const likesClicked = await likesPage.evaluate(() => {
        const selectors = [
          'button[data-control-name*="likes"]',
          'a[data-control-name*="likes"]',
          '.social-details-social-counts__count-value',
          '.social-details-social-counts__social-proof-text',
          'span:contains("reaction")',
          'span:contains("like")'
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            console.log(`Found likes button with selector: ${selector}`);
            (element as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (!likesClicked) {
        console.log('⚠️ Could not find likes button, trying alternative methods...');
        // Try clicking on the likes count number
        const alternativeClicked = await likesPage.evaluate(() => {
          const elements = document.querySelectorAll('span, button, a');
          for (const element of elements) {
            const text = element.textContent?.toLowerCase() || '';
            if (text.includes('reaction') || text.includes('like')) {
              (element as HTMLElement).click();
              return true;
            }
          }
          return false;
        });
        
        if (!alternativeClicked) {
          console.log('❌ Could not find likes button');
          await likesPage.close();
          return [];
        }
      }

      console.log('✅ Likes modal opened, waiting for it to load...');
      await this.delay(8000); // Increased wait time for modal

      // Extract likes from modal
      const likes = await likesPage.evaluate((): LikeData[] => {
        const likes: LikeData[] = [];
        
        // Try different selectors for likes modal
        const modalSelectors = [
          '.artdeco-modal__content',
          'div[role="dialog"]',
          '.social-details-reactors-modal',
          '.scaffold-layout__sidebar',
          'div.artdeco-modal'
        ];
        
        let modal: HTMLElement | null = null;
        for (const selector of modalSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            modal = el as HTMLElement;
            console.log(`Found modal with selector: ${selector}`);
            break;
          }
        }
        
        if (!modal) {
          console.log('No modal found');
          return likes;
        }
        
        // Scroll in modal to load all
        console.log('Scrolling modal to load all profiles...');
        modal.scrollTop = modal.scrollHeight;
        
        // Wait for loading
        setTimeout(() => {
          modal!.scrollTop = modal!.scrollHeight;
        }, 1000);
        
        // Extract profile items with multiple selectors
        const profileSelectors = [
          '.artdeco-list__item',
          '.reactors__profile-item',
          'li.scaffold-layout__list-item',
          'div.reactors-profile'
        ];
        
        let profileItems: Element[] = [];
        for (const selector of profileSelectors) {
          const items = Array.from(modal.querySelectorAll(selector));
          if (items.length > 0) {
            console.log(`Found ${items.length} profile items with selector: ${selector}`);
            profileItems = items;
            break;
          }
        }
        
        console.log(`Total profile items found: ${profileItems.length}`);
        
        profileItems.forEach((item, index) => {
          // Extract name
          let name = '';
          const nameSelectors = [
            '.artdeco-entity-lockup__title',
            '.reactors__profile-name',
            'span[aria-hidden="true"]',
            'a span'
          ];
          
          for (const selector of nameSelectors) {
            const nameElement = item.querySelector(selector);
            if (nameElement) {
              name = nameElement.textContent?.trim() || '';
              if (name) break;
            }
          }
          
          if (!name) return;
          
          // Extract profile URL
          let profileUrl = '';
          const linkSelectors = [
            'a[href*="/in/"]',
            '.artdeco-entity-lockup__link',
            'a.reactors__profile-link'
          ];
          
          for (const selector of linkSelectors) {
            const profileLink = item.querySelector(selector);
            if (profileLink) {
              const href = profileLink.getAttribute('href');
              if (href) {
                profileUrl = `https://www.linkedin.com${href.split('?')[0]}`;
                break;
              }
            }
          }
          
          // Extract headline (job title + company)
          let headline = '';
          const headlineSelectors = [
            '.artdeco-entity-lockup__subtitle',
            '.reactors__profile-headline',
            '.entity-result__primary-subtitle'
          ];
          
          for (const selector of headlineSelectors) {
            const headlineElement = item.querySelector(selector);
            if (headlineElement) {
              headline = headlineElement.textContent?.trim() || '';
              break;
            }
          }
          
          // Extract location
          let location = '';
          const locationSelectors = [
            '.reactors__profile-distance',
            '.entity-result__secondary-subtitle',
            'span[data-test-distance]'
          ];
          
          for (const selector of locationSelectors) {
            const locationElement = item.querySelector(selector);
            if (locationElement) {
              location = locationElement.textContent?.trim() || '';
              break;
            }
          }
          
          likes.push({
            name,
            profileUrl,
            headline,
            location: location || 'Not specified',
            likedAt: new Date().toISOString()
          });
        });
        
        return likes;
      });

      // Now open each profile to get detailed information
      console.log(`🔍 Opening ${likes.length} profiles for detailed information...`);
      
      const detailedLikes: LikeData[] = [];
      let processedCount = 0;
      
      for (const like of likes) {
        if (like.profileUrl) {
          try {
            console.log(`📊 Processing profile ${processedCount + 1}/${likes.length}: ${like.name}`);
            
            const profileDetails = await this.scrapeProfileDetails(like.profileUrl);
            
            detailedLikes.push({
              name: profileDetails.name || like.name,
              profileUrl: profileDetails.profileUrl,
              headline: profileDetails.headline,
              location: profileDetails.location,
              likedAt: like.likedAt,
              company: profileDetails.company
            } as LikeData);
            
            processedCount++;
            
            // Add delay between profile scrapes to avoid detection
            await this.humanLikeDelay(2000, 5000);
            
          } catch (error) {
            console.log(`⚠️ Failed to scrape profile for ${like.name}: ${error}`);
            // Use the data we already have
            detailedLikes.push(like);
          }
        } else {
          detailedLikes.push(like);
        }
      }

      // Close modal
      await likesPage.evaluate(() => {
        const closeButton = document.querySelector('.artdeco-modal__dismiss, button[aria-label*="close"], button[data-control-name*="close"]');
        if (closeButton) {
          (closeButton as HTMLElement).click();
        }
      });

      await likesPage.close();
      console.log(`✅ Extracted ${detailedLikes.length} detailed likes`);
      return detailedLikes;

    } catch (error) {
      console.error('❌ Error scraping likes:', error);
      if (likesPage && !likesPage.isClosed()) {
        await likesPage.close();
      }
      return [];
    }
  }

  private async scrapePostComments(postUrl: string): Promise<CommentData[]> {
    if (!this.browser) return [];

    let commentsPage: Page | null = null;

    try {
      // Open post in new tab for comments
      const navResult = await this.navigateInNewTab(postUrl);
      if (!navResult.success || !navResult.page) {
        return [];
      }
      
      commentsPage = navResult.page;
      console.log('👁️  Watching comments extraction...');
      await this.delay(5000);
      
      // Scroll to load comments section
      await this.slowScroll(commentsPage, 200, 300);
      await this.delay(3000);

      // Click to show comments
      const showCommentsClicked = await commentsPage.evaluate(() => {
        const commentButtonSelectors = [
          'button[data-control-name*="comments"]',
          'button.comments-comments-list__load-more-comments-button',
          'span:contains("comment")',
          'a[data-control-name*="comment"]'
        ];

        for (const selector of commentButtonSelectors) {
          const commentButton = document.querySelector(selector);
          if (commentButton) {
            console.log(`Found comments button with selector: ${selector}`);
            (commentButton as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (!showCommentsClicked) {
        console.log('⚠️ Could not find comments button');
        await commentsPage.close();
        return [];
      }

      console.log('✅ Comments section opened, loading comments...');
      await this.delay(5000);

      // Scroll to load more comments
      await commentsPage.evaluate(async () => {
        const commentsSectionSelectors = [
          '.comments-comments-list',
          '.feed-shared-update-v2__comments-container',
          'div[data-test-comments-list]'
        ];
        
        let commentsSection: HTMLElement | null = null;
        for (const selector of commentsSectionSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            commentsSection = el as HTMLElement;
            break;
          }
        }
        
        if (commentsSection) {
          for (let i = 0; i < 10; i++) { // Scroll 10 times to load all comments
            commentsSection.scrollTop = commentsSection.scrollHeight;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      });

      await this.delay(4000);

      // Extract comments
      const comments = await commentsPage.evaluate((): CommentData[] => {
        const comments: CommentData[] = [];
        
        const commentSelectors = [
          '.comments-comment-item',
          '.comment',
          '.feed-shared-comment',
          'li.comments-comments-list__comment-item'
        ];
        
        let commentElements: Element[] = [];
        for (const selector of commentSelectors) {
          const elements = Array.from(document.querySelectorAll(selector));
          if (elements.length > 0) {
            console.log(`Found ${elements.length} comments with selector: ${selector}`);
            commentElements = elements;
            break;
          }
        }
        
        console.log(`Total comments found: ${commentElements.length}`);
        
        commentElements.forEach(element => {
          // Extract author name
          let name = '';
          const nameSelectors = [
            '.comments-post-meta__name-text',
            '.comment__actor-name',
            '.feed-shared-comment__actor-name',
            'span[aria-hidden="true"]'
          ];
          
          for (const selector of nameSelectors) {
            const authorElement = element.querySelector(selector);
            if (authorElement) {
              name = authorElement.textContent?.trim() || '';
              if (name) break;
            }
          }
          
          if (!name) return;
          
          // Extract profile URL
          let profileUrl = '';
          const linkSelectors = [
            'a[href*="/in/"]',
            '.comments-post-meta__actor-link',
            '.comment__actor-link'
          ];
          
          for (const selector of linkSelectors) {
            const authorLink = element.querySelector(selector);
            if (authorLink) {
              const href = authorLink.getAttribute('href');
              if (href) {
                profileUrl = `https://www.linkedin.com${href.split('?')[0]}`;
                break;
              }
            }
          }
          
          // Extract headline
          let headline = '';
          const headlineSelectors = [
            '.comments-post-meta__headline',
            '.comment__actor-headline',
            '.feed-shared-comment__actor-headline'
          ];
          
          for (const selector of headlineSelectors) {
            const headlineElement = element.querySelector(selector);
            if (headlineElement) {
              headline = headlineElement.textContent?.trim() || '';
              break;
            }
          }
          
          // Extract comment text
          let comment = '';
          const commentSelectors = [
            '.comments-comment-item__main-content',
            '.comment__content',
            '.feed-shared-comment__text',
            'div[dir="ltr"]'
          ];
          
          for (const selector of commentSelectors) {
            const commentElement = element.querySelector(selector);
            if (commentElement) {
              comment = commentElement.textContent?.trim() || '';
              break;
            }
          }
          
          // Extract timestamp
          let commentedAt = new Date().toISOString();
          const timeElement = element.querySelector('time');
          if (timeElement) {
            const datetime = timeElement.getAttribute('datetime');
            if (datetime) commentedAt = datetime;
          }
          
          // Extract likes count
          let likesCount = 0;
          const likesSelectors = [
            '.comments-comment-social-bar__likes-count',
            '.comment__social-count',
            '.feed-shared-comment__social-count'
          ];
          
          for (const selector of likesSelectors) {
            const likesElement = element.querySelector(selector);
            if (likesElement) {
              const likesText = likesElement.textContent || '0';
              const numMatch = likesText.match(/\d+/);
              likesCount = numMatch ? parseInt(numMatch[0]) : 0;
              break;
            }
          }
          
          comments.push({
            name,
            profileUrl,
            headline,
            comment,
            commentedAt,
            likesCount
          });
        });
        
        return comments;
      });

      await commentsPage.close();
      console.log(`✅ Extracted ${comments.length} comments`);
      return comments;

    } catch (error) {
      console.error('❌ Error scraping comments:', error);
      if (commentsPage && !commentsPage.isClosed()) {
        await commentsPage.close();
      }
      return [];
    }
  }

  // Get browser status
  getBrowserStatus(): {
    isConnected: boolean
    tabsOpen: number
    isInitialized: boolean
  } {
    return {
      isConnected: this.browserLaunched && this.browser !== null,
      tabsOpen: this.browser ? 1 : 0,
      isInitialized: this.isInitialized
    };
  }

  // Keep browser open option
  async keepBrowserOpen(): Promise<void> {
    console.log('\n🖥️  Browser will remain open for manual inspection');
    console.log('   You can now manually browse LinkedIn');
    console.log('   Call close() method when done');
  }

  // Close browser
  async close(): Promise<void> {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('🔌 CLOSING LINKEDIN SCRAPER');
      console.log('='.repeat(60));
      
      if (this.browser) {
        console.log('📊 Getting open pages...');
        const pages = await this.browser.pages();
        console.log(`   Found ${pages.length} open pages`);
        
        // Close all pages
        for (const page of pages) {
          if (!page.isClosed()) {
            try {
              console.log('   Closing page...');
              await page.close();
            } catch (error) {
              console.log('⚠️ Error closing page:', error);
            }
          }
        }
        
        // Close browser
        console.log('🖥️  Closing browser...');
        await this.browser.close();
        console.log('✅ Browser closed');
      } else {
        console.log('ℹ️ No browser instance to close');
      }
      
      this.browser = null;
      this.page = null;
      this.browserLaunched = false;
      this.isInitialized = false;
      
      console.log('✅ Cleanup complete');
      console.log('='.repeat(60) + '\n');
      
    } catch (error) {
      console.error('❌ Error closing:', error);
    }
  }
}

// Export for use in other files
export default LinkedInScraper;