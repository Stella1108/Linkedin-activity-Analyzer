import puppeteer, { Browser, Page } from 'puppeteer';

// ============ INTERFACES ============
export interface LikeData {
  name: string;
  profileUrl?: string;
  jobTitle?: string;
  company?: string;
  likedAt: string;
  postAuthor: string;
  postContent: string;
}

export interface CommentData {
  name: string;
  profileUrl?: string;
  jobTitle?: string;
  company?: string;
  commentText: string;
  commentedAt: string;
  postAuthor: string;
  postContent: string;
}

export interface PostData {
  author: string;
  authorProfileUrl?: string;
  content: string;
  postUrl?: string;
  postedAt: string;
  likesCount: number;
  commentsCount: number;
}

export interface LinkedInProfileData {
  li_at: string;
  name?: string;
  email?: string;
  is_active?: boolean;
  updated_at?: string;
  last_used?: string;
}

export interface ScrapeResult {
  success: boolean;
  data: {
    likes: LikeData[];
    comments: CommentData[];
    profileUrl: string;
    scrapedAt: string;
    posts: PostData[];
  };
  error?: string;
  stats?: {
    totalProfiles: number;
    totalPosts: number;
    totalComments: number;
    extractionTime: number;
  };
}

export class LinkedInScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private profileData: LinkedInProfileData | null = null;
  private browserLaunched = false;
  private isInitialized = false;

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---------- UTILITY: CLEAN NAME ----------
  private cleanName(rawName: string): string {
    if (!rawName) return 'Not specified';
    let name = rawName.trim();
    const viewIndex = name.search(/View\s/i);
    if (viewIndex !== -1) {
      name = name.substring(0, viewIndex).trim();
    }
    name = name.replace(/\.{3,}$/, '').trim();
    return name || 'Not specified';
  }

  // ---------- CLEAN COMPANY NAME (remove employment type suffixes) ----------
  private cleanCompany(rawCompany: string): string {
    if (!rawCompany || rawCompany === 'Not specified') return 'Not specified';
    const employmentTypeRegex = /·\s*(Full[- ]?time|Part[- ]?time|Contract|Freelance|Self[- ]?employed|Internship|Trainee|Apprenticeship|Volunteer|Temporary|Seasonal|Remote|Hybrid)\s*/gi;
    let cleaned = rawCompany.replace(employmentTypeRegex, '').trim();
    cleaned = cleaned.replace(/[·\-–—|]\s*$/, '').trim();
    return cleaned || 'Not specified';
  }

  // ==========================================================================
  // ✅ HELPER: CHECK IF TEXT LOOKS LIKE A COMPANY NAME
  // ==========================================================================
  private looksLikeCompany(text: string): boolean {
    if (!text || text.length < 2 || text.length > 60) return false;

    const lower = text.toLowerCase();
    
    const companySuffixes = [
      'inc', 'ltd', 'llc', 'corp', 'corporation', 'company', 
      'group', 'solutions', 'technologies', 'systems', 'services',
      'consulting', 'associates', 'partners', 'limited', 'global',
      'industries', 'holdings', 'enterprises', 'labs', 'studio',
      'agency', 'firm', 'office', 'institute', 'university', 'college',
      'school', 'hospital', 'clinic', 'bank', 'financial', 'insurance',
      'healthcare', 'pharma', 'biotech', 'software', 'hardware', 'networks'
    ];
    
    for (const suffix of companySuffixes) {
      if (lower.includes(suffix)) return true;
    }
    
    if (/^[A-Z]/.test(text) && text.length >= 3) {
      const jobKeywords = [
        'engineer', 'developer', 'manager', 'director', 'specialist', 
        'analyst', 'consultant', 'associate', 'lead', 'head', 'chief',
        'officer', 'coordinator', 'assistant', 'representative', 'supervisor',
        'architect', 'designer', 'administrator', 'technician', 'scientist',
        'researcher', 'instructor', 'teacher', 'professor', 'president',
        'vp', 'vice president', 'partner', 'principal', 'senior', 'junior',
        'staff', 'intern', 'trainee', 'apprentice', 'fellow'
      ];
      for (const keyword of jobKeywords) {
        if (lower.includes(keyword)) return false;
      }
      return true;
    }
    
    return false;
  }

  // ---------- INITIALIZATION (HEADLESS MODE - UPDATED) ----------
  async initialize(profileData: LinkedInProfileData, targetUrl: string): Promise<{ browser: Browser; page: Page }> {
    this.profileData = profileData;

    console.log('\n' + '='.repeat(60));
    console.log('🚀 INITIALIZING LINKEDIN SCRAPER (HEADLESS MODE)');
    console.log('='.repeat(60));

    if (!profileData.li_at?.startsWith('AQED')) {
      throw new Error('Invalid li_at cookie format');
    }

    // 🔁 UPDATED: headless set to 'new' (invisible mode) while keeping all enhancements
    const launchOptions: any = {
      headless: 'new',  // 👈 now invisible again
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-notifications',
        '--disable-infobars',
        '--hide-scrollbars',
        '--mute-audio',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      defaultViewport: { width: 1920, height: 1080 },
      timeout: 60000,
      ignoreDefaultArgs: ['--enable-automation'],
    };

    try {
      console.log('🖥️  Launching browser in headless mode (invisible)...');
      this.browser = await puppeteer.launch(launchOptions);
      this.browserLaunched = true;
      this.page = await this.browser.newPage();

      // Override automation detection
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        (window as any).chrome = { runtime: {} };
      });

      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await this.page.setViewport({ width: 1920, height: 1080 });

      const oneYearFromNow = Math.floor(Date.now() / 1000) + 31536000;
      await this.page.setCookie({
        name: 'li_at',
        value: profileData.li_at,
        domain: '.linkedin.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'None' as const,
        expires: oneYearFromNow
      });

      console.log('🍪 Cookies set');
      console.log('🌐 STEP 1: Navigating to LinkedIn FEED...');
      
      await this.page.goto('https://www.linkedin.com/feed', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      await this.delay(5000);

      const currentUrl = this.page.url();
      if (currentUrl.includes('login') || currentUrl.includes('signin')) {
        throw new Error('Login failed - cookie may be expired');
      }
      console.log('✅ Login successful');

      console.log(`\n🌐 STEP 2: Navigating to target profile: ${targetUrl}`);
      
      await this.page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      await this.delay(5000);

      try {
        await this.page.waitForSelector('h1', { timeout: 10000 });
        console.log('✅ Profile name found');
      } catch (e) {
        console.log('⚠️ Profile name selector timeout, continuing...');
      }

      console.log('✅ Profile loaded');
      this.isInitialized = true;

      return { browser: this.browser, page: this.page };
    } catch (error: any) {
      console.error('❌ Initialization failed:', error.message);
      await this.close();
      throw error;
    }
  }

  // ---------- AUTO SCROLL ----------
  private async autoScrollToLoadPosts(): Promise<void> {
    if (!this.page) return;
    console.log('\n📜 Auto-scrolling to load posts...');
    for (let i = 0; i < 3; i++) {
      console.log(`📜 Scroll ${i + 1}/3`);
      await this.page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
      await this.delay(2000);
    }
    console.log('✅ Auto-scroll completed');
  }

  // ---------- FIND LIKE BUTTONS ----------
  private async findLikeButtons(): Promise<
    {
      index: number;
      likesCount: number;
      author: string;
      authorProfileUrl?: string;
      text: string;
    }[]
  > {
    if (!this.page) return [];

    console.log('\n🔍 Finding like count buttons...');

    return await this.page.evaluate(() => {
      const selectors = [
        '.feed-shared-social-counts a[href*="reactions"]',
        'button[data-control-name*="likes"]',
        '.social-details-social-counts__count',
        '.social-details-social-counts__reactions-count',
        'a[href*="reactions"] span',
        '.feed-shared-social-action__count'
      ];

      let allButtons: Element[] = [];
      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((btn) => allButtons.push(btn));
      });
      allButtons = [...new Set(allButtons)];

      const results: any[] = [];

      allButtons.forEach((button, idx) => {
        const buttonText = button.textContent || '';
        const hasNumber = /\d+/.test(buttonText);
        const isClickable =
          button.tagName === 'A' ||
          button.tagName === 'BUTTON' ||
          button.closest('a') ||
          button.closest('button');

        if (hasNumber && isClickable) {
          const match = buttonText.match(/\d+/);
          const likesCount = match ? parseInt(match[0]) : 0;

          if (likesCount > 0) {
            let author = 'Unknown';
            let authorProfileUrl = '';
            const postElement = button.closest(
              '.feed-shared-update-v2, .scaffold-layout__list-item, article'
            );
            if (postElement) {
              const authorElement = postElement.querySelector(
                '.feed-shared-actor__name, .update-components-actor__name'
              );
              if (authorElement) {
                author = authorElement.textContent?.trim() || 'Unknown';
                const authorLink = authorElement.closest('a');
                if (authorLink) {
                  const href = authorLink.getAttribute('href');
                  if (href) {
                    authorProfileUrl = href.startsWith('http')
                      ? href
                      : `https://www.linkedin.com${href.split('?')[0]}`;
                  }
                }
              }
            }

            button.setAttribute('data-like-index', idx.toString());

            results.push({
              index: idx,
              likesCount,
              author,
              authorProfileUrl,
              text: buttonText.trim()
            });
          }
        }
      });

      return results;
    });
  }

  // ---------- CLICK LIKE BUTTON ----------
  private async clickLikeButton(buttonIndex: number): Promise<boolean> {
    if (!this.page) return false;

    console.log(`\n🖱️  Clicking like button ${buttonIndex}...`);

    try {
      await this.page.evaluate((index) => {
        const elements = document.querySelectorAll('[data-like-index]');
        if (elements[index]) {
          elements[index].scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
          });
        }
      }, buttonIndex);

      await this.delay(2000);

      const clicked = await this.page.evaluate((index) => {
        const elements = document.querySelectorAll('[data-like-index]');
        if (!elements[index]) return false;

        const el = elements[index] as HTMLElement;

        if (el.tagName === 'A') {
          const handler = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            el.removeEventListener('click', handler);
          };
          el.addEventListener('click', handler, { once: true });
          el.click();
          return true;
        } else {
          el.click();
          return true;
        }
      }, buttonIndex);

      if (!clicked) {
        console.log('   ❌ Could not click');
        return false;
      }

      console.log('   ✅ Clicked (modal should open)');
      console.log('   ⏳ Waiting for reactions modal...');
      await this.delay(5000);

      return true;
    } catch (error: any) {
      console.error('❌ Error clicking like button:', error.message);
      return false;
    }
  }

  // ==========================================================================
  // ✅ EXTRACT PROFILE URLs FROM MODAL (now respects maxProfiles)
  // ==========================================================================
  private async extractProfileUrlsFromModal(
    postAuthor: string,
    postLikesCount: number,
    maxProfiles: number = 50
  ): Promise<any[]> {
    if (!this.page) return [];

    console.log('\n🔗 Extracting profile URLs from likes modal...');
    console.log(`   Will load up to ${maxProfiles} profiles (or all available).`);

    try {
      await this.page.waitForSelector('.artdeco-modal, [role="dialog"]', { timeout: 10000 });
      console.log('   ✅ Modal detected');
    } catch (error) {
      console.log('   ⚠️ Modal selector not found, trying alternative...');
    }
    
    await this.delay(2000);

    console.log('   📜 Scrolling modal to load more profiles...');
    
    let previousCount = 0;
    let sameCountIterations = 0;
    const maxScrollAttempts = 30; // increased to allow deeper scrolling
    
    for (let scrollAttempt = 0; scrollAttempt < maxScrollAttempts; scrollAttempt++) {
      const currentCount = await this.page.evaluate(() => {
        return document.querySelectorAll('a[href*="/in/"]').length;
      });
      
      console.log(`   📊 Scroll ${scrollAttempt + 1}/${maxScrollAttempts} - Profiles loaded: ${currentCount}`);
      
      // Stop if we've reached the user-requested maximum
      if (currentCount >= maxProfiles) {
        console.log(`   ✅ Reached target count: ${currentCount}/${maxProfiles}`);
        break;
      }
      
      if (currentCount === previousCount) {
        sameCountIterations++;
        console.log(`   ⏸️ No new profiles (attempt ${sameCountIterations}/3)`);
        if (sameCountIterations >= 3) {
          console.log('   ⏸️ No more profiles loading, stopping scroll');
          break;
        }
      } else {
        sameCountIterations = 0;
      }
      
      previousCount = currentCount;
      
      await this.page.evaluate(async () => {
        const modal = document.querySelector('.artdeco-modal, [role="dialog"], .artdeco-modal__content, .reactions-modal__list');
        if (modal) {
          modal.scrollBy(0, 800);
        } else {
          window.scrollBy(0, 800);
        }
        
        const scrollableElements = document.querySelectorAll('.overflow-auto, .modal__content, .artdeco-modal__content');
        scrollableElements.forEach(el => {
          el.scrollBy(0, 800);
        });
      });
      
      await this.delay(2500);
    }

    await this.delay(3000);

    console.log('   🔗 Extracting profile URLs...');
    
    const profiles = await this.page.evaluate(
      (author, likes) => {
        const results: any[] = [];
        const uniqueProfiles = new Map();

        const profileLinks = document.querySelectorAll(
          'a[href*="/in/"], a[data-control-name="profile"], [data-anonymize="person-name"] a, .reactions-modal__list-item a'
        );
        
        profileLinks.forEach((link) => {
          try {
            const href = link.getAttribute('href');
            if (!href) return;
            
            let cleanHref = href.split('?')[0];
            
            let profileUrl = cleanHref.startsWith('http') 
              ? cleanHref 
              : `https://www.linkedin.com${cleanHref}`;
            
            if (!profileUrl.includes('/in/') || 
                profileUrl.includes('miniProfile') || 
                profileUrl.includes('urn')) {
              return;
            }
            
            let name = '';
            
            const parent = link.closest(
              '.artdeco-entity-lockup, .reactors__profile-item, li, .profile-item, .feed-shared-actor, .reactions-modal__list-item'
            );
            if (parent) {
              const nameEl = parent.querySelector(
                '.artdeco-entity-lockup__title, .reactors__profile-name, .profile-item-title, h3, .feed-shared-actor__name, .reactions-modal__profile-name'
              );
              if (nameEl) {
                name = nameEl.textContent?.trim() || '';
              }
            }
            
            if (!name) {
              name = link.textContent?.trim() || link.getAttribute('aria-label') || '';
            }
            
            if (!name) {
              const urlParts = profileUrl.split('/in/')[1];
              if (urlParts) {
                name = urlParts.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                name = name.replace(/\/$/, '');
              }
            }
            
            if (name && name !== 'LinkedIn Member' && name.length > 1) {
              name = name.replace(/View\s.*$/, '').trim();
              
              uniqueProfiles.set(profileUrl, {
                name,
                profileUrl,
                likedAt: new Date().toISOString(),
                postAuthor: author,
                postContent: `Post with ${likes} likes`
              });
            }
          } catch (e) {
            // Skip invalid entries
          }
        });

        return Array.from(uniqueProfiles.values());
      },
      postAuthor,
      postLikesCount
    );

    console.log(`📊 Final count: Found ${profiles.length} valid profile URLs`);
    
    const cleaned = profiles.map((p: any) => ({
      ...p,
      name: this.cleanName(p.name)
    }));

    cleaned.forEach((p, i) => {
      if (i < 10) {
        console.log(`   ${i+1}. ${p.name}: ${p.profileUrl}`);
      } else if (i === 10) {
        console.log(`   ... and ${profiles.length - 10} more profiles`);
      }
    });
    
    return cleaned;
  }

  // ==========================================================================
  // ✅ HELPER: EXTRACT COMPANY FROM HEADLINE
  // ==========================================================================
  private extractCompanyFromHeadline(headline: string): string | null {
    if (!headline || headline === 'Not specified') return null;
    
    const separators = [' at ', ' @ ', ' · ', ' - ', ' | ', ' • ', ' / ', ' , '];
    
    for (const sep of separators) {
      if (headline.includes(sep)) {
        const parts = headline.split(sep);
        if (parts.length >= 2) {
          let possibleCompany = parts.slice(1).join(sep).trim();
          possibleCompany = this.cleanCompany(possibleCompany);
          if (this.looksLikeCompany(possibleCompany)) {
            return possibleCompany;
          }
        }
      }
    }
    
    return null;
  }

  // ==========================================================================
  // ✅ HELPER: EXTRACT FROM EXPERIENCE SECTION
  // ==========================================================================
  private async extractFromExperienceSection(page: Page): Promise<{ jobTitle: string; company: string } | null> {
    try {
      console.log('   🔍 Searching for experience section...');

      // Scroll down a few times to reveal the experience section
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, 800);
        });
        await this.delay(1000);
      }

      const experienceData = await page.evaluate(() => {
        const cleanText = (text: string | null | undefined): string => {
          if (!text) return '';
          return text.replace(/\s+/g, ' ').trim();
        };

        const isJobTitle = (text: string): boolean => {
          const lower = text.toLowerCase();
          const jobKeywords = [
            'engineer', 'developer', 'manager', 'director', 'specialist', 
            'analyst', 'consultant', 'associate', 'lead', 'head', 'chief',
            'officer', 'coordinator', 'assistant', 'representative', 'supervisor',
            'architect', 'designer', 'administrator', 'technician', 'scientist',
            'researcher', 'instructor', 'teacher', 'professor', 'president',
            'vp', 'vice president', 'partner', 'principal', 'senior', 'junior',
            'staff', 'intern', 'trainee', 'apprentice', 'fellow'
          ];
          for (const keyword of jobKeywords) {
            if (lower.includes(keyword)) return true;
          }
          return text.length < 60 && text.length > 2;
        };

        const isCompany = (text: string): boolean => {
          const lower = text.toLowerCase();
          const companySuffixes = [
            'inc', 'ltd', 'llc', 'corp', 'corporation', 'company', 
            'group', 'solutions', 'technologies', 'systems', 'services',
            'consulting', 'associates', 'partners', 'limited', 'global',
            'industries', 'holdings', 'enterprises', 'labs', 'studio',
            'agency', 'firm', 'office', 'institute', 'university', 'college',
            'school', 'hospital', 'clinic', 'bank', 'financial', 'insurance',
            'healthcare', 'pharma', 'biotech', 'software', 'hardware', 'networks'
          ];
          for (const suffix of companySuffixes) {
            if (lower.includes(suffix)) return true;
          }
          return text.length > 2 && /^[A-Z]/.test(text);
        };

        const findExperienceSection = (): Element | null => {
          const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'];
          for (const tag of headingTags) {
            const elements = document.querySelectorAll(tag);
            for (const el of elements) {
              const text = el.textContent?.trim().toLowerCase() || '';
              if (text === 'experience' || text.includes('experience')) {
                return el.closest('section, div[data-view-name], .pvs-list__container, .pvs-list, article') || el.parentElement;
              }
            }
          }
          return document.querySelector('#experience, #experience-section, .experience-section, section[aria-label*="Experience" i]');
        };

        let experienceSection = findExperienceSection();
        if (!experienceSection) return null;

        const experienceItems = experienceSection.querySelectorAll('li, .pvs-entity, [data-view-name="profile-components"], .pvs-list__item, .pvs-entity--padded');
        if (experienceItems.length === 0) return null;

        const firstItem = experienceItems[0];

        const spans = firstItem.querySelectorAll('span[aria-hidden="true"]');
        if (spans.length >= 2) {
          const jobTitle = cleanText(spans[0].textContent);
          const company = cleanText(spans[1].textContent);
          if (jobTitle && company) return { jobTitle, company };
        }

        const strongTags = firstItem.querySelectorAll('strong, b, .t-bold');
        if (strongTags.length > 0) {
          const jobTitle = cleanText(strongTags[0].textContent);
          let company = '';
          const container = strongTags[0].closest('div, li, .pvs-entity');
          if (container) {
            const textElements = container.querySelectorAll('span, div, .t-14, .t-normal, .t-black--light');
            for (const el of textElements) {
              const text = cleanText(el.textContent);
              if (text && text !== jobTitle && text.length > 2 && isCompany(text)) {
                company = text;
                break;
              }
            }
          }
          if (jobTitle && company) return { jobTitle, company };
        }

        const atMatch = firstItem.textContent?.match(/(.+?)\s+at\s+(.+?)(?:\n|$)/i);
        if (atMatch) {
          return { jobTitle: cleanText(atMatch[1]), company: cleanText(atMatch[2]) };
        }

        return null;
      });

      return experienceData;
    } catch (error: any) {
      console.log(`   ⚠️ Error in extractFromExperienceSection: ${error.message}`);
      return null;
    }
  }

  // ==========================================================================
  // ✅ SCRAPE PROFILE PAGE (now with fallback to experience section)
  // ==========================================================================
  private async scrapeProfilePage(profileUrl: string): Promise<{
    name: string;
    jobTitle: string;
    company: string;
    profileUrl: string;
  }> {
    const newPage = await this.browser!.newPage();
    await newPage.setViewport({ width: 1280, height: 800 });
    await newPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await newPage.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      (window as any).chrome = { runtime: {} };
    });

    const isAuthWall = (url: string) => {
      return url.includes('login') || url.includes('signin') || url.includes('authwall') || url.includes('checkpoint');
    };

    let retries = 3;
    let lastError: any;

    while (retries > 0) {
      try {
        console.log(`   🚶 Navigating to profile: ${profileUrl} (${retries} retries left)`);
        
        await newPage.goto(profileUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        const currentUrl = newPage.url();
        if (isAuthWall(currentUrl)) {
          console.log('   ⚠️ Redirected to login page');
          const nameFromUrl = this.getNameFromUrlFallback(profileUrl);
          return {
            name: nameFromUrl,
            jobTitle: 'Not specified',
            company: 'Not specified',
            profileUrl
          };
        }

        await this.delay(3000);

        // Extract profile data from the main page
        let profileData = await newPage.evaluate(() => {
          const getText = (selectors: string[]): string => {
            for (const selector of selectors) {
              const el = document.querySelector(selector);
              if (el && el.textContent?.trim()) {
                return el.textContent.trim().replace(/\s+/g, ' ');
              }
            }
            return '';
          };

          const nameSelectors = [
            'h1',
            '.top-card-layout__title',
            '.pv-top-card--list .t-24',
            '[data-anonymize="person-name"]'
          ];
          
          let name = getText(nameSelectors);
          
          if (!name) {
            const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
            if (metaTitle) {
              name = metaTitle.split(' | ')[0].trim();
            }
          }
          
          name = name || 'Not specified';

          const headlineSelectors = [
            '.text-body-medium',
            '.top-card-layout__headline',
            '.pv-top-card--list .pv-top-card__headline',
            '[data-anonymize="headline"]',
            '.mt2 .text-body-medium'
          ];
          
          const headline = getText(headlineSelectors);

          const companyButtonSelectors = [
            'button[aria-label*="Current company"]',
            '.pv-text-details__right-panel-item-link',
            '.inline-show-more-text--full'
          ];
          
          let companyFromButton = 'Not specified';
          for (const selector of companyButtonSelectors) {
            const companyButton = document.querySelector(selector);
            if (companyButton) {
              const buttonText = companyButton.textContent?.trim();
              if (buttonText && buttonText.length > 1 && buttonText.length < 50) {
                companyFromButton = buttonText;
                break;
              }
            }
          }

          return { name, headline, companyFromButton };
        });

        let { name, headline, companyFromButton } = profileData;
        let jobTitle = 'Not specified';
        let company = companyFromButton;

        // Parse headline if present
        if (headline && headline !== 'Not specified') {
          console.log(`   📝 Headline: "${headline}"`);
          
          const atIndex = headline.indexOf(' at ');
          if (atIndex !== -1) {
            jobTitle = headline.substring(0, atIndex).trim();
            const potentialCompany = headline.substring(atIndex + 4).trim();
            if (potentialCompany && potentialCompany.length > 1) {
              company = this.cleanCompany(potentialCompany);
            }
          } else {
            jobTitle = headline;
          }
        }

        // ➕ ADDED: If jobTitle or company are still missing, try to extract from experience section
        if (jobTitle === 'Not specified' || company === 'Not specified' || company === '') {
          console.log('   ⚠️ Job title or company missing, attempting to extract from Experience section...');
          const expData = await this.extractFromExperienceSection(newPage);
          if (expData) {
            if (jobTitle === 'Not specified' && expData.jobTitle) {
              jobTitle = expData.jobTitle;
            }
            if (company === 'Not specified' && expData.company) {
              company = expData.company;
            }
          }
        }

        console.log(`   ✅ Final: "${name}" | Job: "${jobTitle}" | Company: "${company}"`);
        
        await newPage.close();
        return {
          name,
          jobTitle,
          company,
          profileUrl
        };

      } catch (error: any) {
        lastError = error;
        retries--;
        if (retries > 0) {
          console.log(`   ⚠️ Retry failed, ${retries} left...`);
          await this.delay(5000);
        }
      }
    }

    console.error(`   ❌ Failed to scrape: ${lastError?.message}`);
    await newPage.close();
    
    return {
      name: this.getNameFromUrlFallback(profileUrl),
      jobTitle: 'Not specified',
      company: 'Not specified',
      profileUrl
    };
  }

  private getNameFromUrlFallback(profileUrl: string): string {
    try {
      const urlParts = profileUrl.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart && lastPart !== 'in' && !lastPart.includes('?')) {
        return lastPart.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    } catch (e) {}
    return 'Not specified';
  }

  // ---------- CLOSE MODAL ----------
  private async closeModal(): Promise<void> {
    if (!this.page) return;
    
    await this.page.evaluate(() => {
      const closeSelectors = [
        '.artdeco-modal__dismiss',
        'button[aria-label="Dismiss"]',
        'button[aria-label="Close"]',
        '.artdeco-modal__close-button'
      ];
      for (const sel of closeSelectors) {
        const btn = document.querySelector(sel);
        if (btn) {
          (btn as HTMLElement).click();
          break;
        }
      }
    });
    await this.delay(2000);
  }

  // ==========================================================================
  // ✅ MAIN SCRAPING FUNCTION
  // ==========================================================================
  async scrapeProfileActivity(
    profileUrl: string,
    maxLikes: number = 50   // 👈 this is the user-controlled value
  ): Promise<ScrapeResult> {
    if (!this.browser || !this.page) {
      throw new Error('Scraper not initialized');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 STARTING SCRAPING');
    console.log(`📊 User requested up to ${maxLikes} profiles`);
    console.log('='.repeat(60));

    const result: ScrapeResult = {
      success: false,
      data: {
        likes: [],
        comments: [],
        profileUrl,
        scrapedAt: new Date().toISOString(),
        posts: []
      }
    };

    try {
      await this.autoScrollToLoadPosts();

      const likeButtons = await this.findLikeButtons();

      if (likeButtons.length === 0) {
        result.error = 'No like buttons found';
        return result;
      }

      const button = likeButtons[0];
      console.log(`\n📝 Processing post: ${button.author} (${button.likesCount} likes)`);

      if (!(await this.clickLikeButton(button.index))) {
        result.error = 'Could not open likes modal';
        return result;
      }

      // Pass maxLikes to the modal extraction so it stops scrolling when enough profiles are loaded
      const profileUrls = await this.extractProfileUrlsFromModal(
        button.author,
        button.likesCount,
        maxLikes
      );

      if (profileUrls.length === 0) {
        result.error = 'No profile URLs found';
        return result;
      }

      await this.closeModal();

      console.log(`\n👥 Processing ${profileUrls.length} profiles...`);

      const enrichedProfiles: LikeData[] = [];

      for (let i = 0; i < Math.min(profileUrls.length, maxLikes); i++) {
        const profile = profileUrls[i];
        console.log(`\n👤 [${i + 1}/${Math.min(profileUrls.length, maxLikes)}] ${profile.name}`);

        const fullData = await this.scrapeProfilePage(profile.profileUrl);

        enrichedProfiles.push({
          name: fullData.name || profile.name,
          profileUrl: profile.profileUrl,
          jobTitle: fullData.jobTitle,
          company: fullData.company,
          likedAt: profile.likedAt,
          postAuthor: profile.postAuthor,
          postContent: profile.postContent
        });

        if (i < Math.min(profileUrls.length, maxLikes) - 1) {
          await this.delay(3000);
        }
      }

      result.data.likes = enrichedProfiles;
      result.success = true;

      console.log('\n' + '='.repeat(80));
      console.log('🎉 SCRAPING COMPLETE!');
      console.log('='.repeat(80));
      console.log(`✅ Extracted: ${result.data.likes.length} profiles`);

      return result;
    } catch (error: any) {
      console.error('\n❌ ERROR:', error.message);
      result.error = error.message;
      return result;
    }
  }

  getBrowserStatus() {
    return {
      isConnected: !!this.browser && this.browserLaunched,
      tabsOpen: this.browser ? 1 : 0,
      isInitialized: this.isInitialized,
      currentUrl: this.page?.url() || 'No page'
    };
  }

  async close(): Promise<void> {
    try {
      console.log('\n🔌 Closing browser...');
      if (this.browser) {
        await this.browser.close();
      }
      this.browser = null;
      this.page = null;
      this.browserLaunched = false;
      this.isInitialized = false;
      console.log('✅ Browser closed');
    } catch (error) {
      console.error('❌ Error closing browser:', error);
    }
  } 
}

export default LinkedInScraper;