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
    // Remove common employment type indicators like "· Full-time", "· Part-time", etc.
    const employmentTypeRegex = /·\s*(Full[- ]?time|Part[- ]?time|Contract|Freelance|Self[- ]?employed|Internship|Trainee|Apprenticeship|Volunteer|Temporary|Seasonal|Remote|Hybrid)\s*/gi;
    let cleaned = rawCompany.replace(employmentTypeRegex, '').trim();
    // Also remove any trailing separators like "·" or "-" if they remain
    cleaned = cleaned.replace(/[·\-–—|]\s*$/, '').trim();
    return cleaned || 'Not specified';
  }

  // ==========================================================================
  // ✅ HELPER: CHECK IF TEXT LOOKS LIKE A COMPANY NAME
  // ==========================================================================
  private looksLikeCompany(text: string): boolean {
    if (!text || text.length < 2 || text.length > 60) return false;

    const lower = text.toLowerCase();
    
    // Common company suffixes
    const companySuffixes = [
      'inc', 'ltd', 'llc', 'corp', 'corporation', 'company', 
      'group', 'solutions', 'technologies', 'systems', 'services',
      'consulting', 'associates', 'partners', 'limited', 'global',
      'industries', 'holdings', 'enterprises', 'labs', 'studio',
      'agency', 'firm', 'office', 'institute', 'university', 'college',
      'school', 'hospital', 'clinic', 'bank', 'financial', 'insurance',
      'healthcare', 'pharma', 'biotech', 'software', 'hardware', 'networks'
    ];
    
    // Check if it contains any company suffix
    for (const suffix of companySuffixes) {
      if (lower.includes(suffix)) return true;
    }
    
    // If it starts with a capital letter and has at least 3 characters, it might be a company name
    if (/^[A-Z]/.test(text) && text.length >= 3) {
      // But ensure it doesn't look like a job title (i.e., doesn't contain common job keywords)
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

  // ---------- INITIALIZATION ----------
  async initialize(profileData: LinkedInProfileData, targetUrl: string): Promise<{ browser: Browser; page: Page }> {
    this.profileData = profileData;

    console.log('\n' + '='.repeat(60));
    console.log('🚀 INITIALIZING LINKEDIN SCRAPER');
    console.log('='.repeat(60));

    if (!profileData.li_at?.startsWith('AQED')) {
      throw new Error('Invalid li_at cookie format');
    }

    const launchOptions: any = {
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
    };

    try {
      console.log('🖥️  Launching browser...');
      this.browser = await puppeteer.launch(launchOptions);
      this.browserLaunched = true;
      this.page = await this.browser.newPage();

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
        timeout: 60000
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
        timeout: 60000
      });
      await this.delay(5000);

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
            (button as HTMLElement).style.border = '3px solid blue';
            (button as HTMLElement).style.backgroundColor = 'rgba(0,115,177,0.1)';

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

  // ---------- CLICK LIKE BUTTON (WITH NAVIGATION PREVENTION) ----------
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
          (elements[index] as HTMLElement).style.border = '3px solid red';
          (elements[index] as HTMLElement).style.boxShadow = '0 0 20px red';
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
  // ✅ STEP 1: EXTRACT UNIQUE PROFILE URLs FROM MODAL (WITH SCROLLING)
  // ==========================================================================
  private async extractProfileUrlsFromModal(
    postAuthor: string,
    postLikesCount: number,
    maxProfiles: number = 50
  ): Promise<any[]> {
    if (!this.page) return [];

    console.log('\n🔗 Extracting profile URLs from likes modal...');

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
    const maxScrollAttempts = 15;
    
    for (let scrollAttempt = 0; scrollAttempt < maxScrollAttempts; scrollAttempt++) {
      const currentCount = await this.page.evaluate(() => {
        return document.querySelectorAll('a[href*="/in/"]').length;
      });
      
      console.log(`   📊 Scroll ${scrollAttempt + 1}/${maxScrollAttempts} - Profiles loaded: ${currentCount}`);
      
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
        
        console.log(`   Found ${profileLinks.length} profile links in DOM`);
        
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
  // ✅ HELPER: EXTRACT COMPANY FROM TOP SECTION HEADLINE (with validation)
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
  // ✅ HELPER: EXTRACT JOB TITLE & COMPANY FROM EXPERIENCE SECTION
  // ==========================================================================
  private async extractFromExperienceSection(page: Page): Promise<{ jobTitle: string; company: string } | null> {
    try {
      console.log('   🔍 Searching for experience section using HTML tags...');

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

        const findExperienceByHeading = (): Element | null => {
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
          return null;
        };

        const findExperienceByAria = (): Element | null => {
          const sections = document.querySelectorAll('section[aria-label*="Experience" i], section[aria-label*="experience" i]');
          return sections.length > 0 ? sections[0] : null;
        };

        const findExperienceById = (): Element | null => {
          return document.querySelector('#experience, #experience-section, .experience-section');
        };

        const findExperienceByClass = (): Element | null => {
          const classPatterns = [
            '.pvs-list__container',
            '.pvs-list',
            '[data-view-name="profile-components"]',
            '.pvs-entity',
            '.pvs-list__item',
            '.experience-item',
            '.profile-section-card'
          ];
          for (const pattern of classPatterns) {
            const elements = document.querySelectorAll(pattern);
            for (const el of elements) {
              const hasDates = el.querySelector('span[aria-hidden="true"]') || 
                               el.textContent?.match(/\d{4}/) ||
                               el.textContent?.toLowerCase().includes('present') ||
                               el.textContent?.toLowerCase().includes('current');
              if (hasDates) return el;
            }
          }
          return null;
        };

        let experienceSection = findExperienceByHeading() || 
                               findExperienceByAria() || 
                               findExperienceById() || 
                               findExperienceByClass();

        if (!experienceSection) {
          const allLists = document.querySelectorAll('ul, ol, .pvs-list');
          for (const list of allLists) {
            const items = list.querySelectorAll('li, .pvs-list__item');
            if (items.length > 0) {
              const firstItem = items[0];
              const itemText = firstItem.textContent || '';
              if (itemText.includes('·') || itemText.includes('at') || itemText.includes('@') || itemText.match(/\d{4}/)) {
                experienceSection = list;
                break;
              }
            }
          }
        }

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

        const displayFlexElements = firstItem.querySelectorAll('.display-flex, .flex-row, .flex');
        for (const flexEl of displayFlexElements) {
          const flexSpans = flexEl.querySelectorAll('span');
          if (flexSpans.length >= 2) {
            const firstSpan = cleanText(flexSpans[0].textContent);
            const secondSpan = cleanText(flexSpans[1].textContent);
            if (firstSpan && secondSpan) {
              if (isJobTitle(firstSpan) && isCompany(secondSpan)) {
                return { jobTitle: firstSpan, company: secondSpan };
              } else if (isCompany(firstSpan) && isJobTitle(secondSpan)) {
                return { jobTitle: secondSpan, company: firstSpan };
              }
            }
          }
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

        const allText = firstItem.textContent || '';
        const datePattern = /\d{4}\s*[-–—]\s*(\d{4}|Present|Current)/i;
        const dateMatch = allText.match(datePattern);
        if (dateMatch) {
          const textBeforeDate = allText.substring(0, dateMatch.index).trim();
          const separators = ['\n', '·', '|', '•', '-', '–', '—'];
          let parts = [textBeforeDate];
          for (const sep of separators) {
            if (textBeforeDate.includes(sep)) {
              parts = textBeforeDate.split(sep).map(p => cleanText(p)).filter(p => p.length > 0);
              break;
            }
          }
          if (parts.length >= 2) {
            return { jobTitle: parts[0], company: parts[1] };
          } else if (parts.length === 1) {
            const atMatch = parts[0].match(/(.+?)\s+(?:at|@)\s+(.+)/i);
            if (atMatch) {
              return { jobTitle: cleanText(atMatch[1]), company: cleanText(atMatch[2]) };
            }
          }
        }

        const patterns = [
          { regex: /(.+?)\s+at\s+(.+?)(?:\n|$)/i, jobIdx: 1, companyIdx: 2 },
          { regex: /(.+?)\s+@\s+(.+?)(?:\n|$)/i, jobIdx: 1, companyIdx: 2 },
          { regex: /(.+?)\s+·\s+(.+?)(?:\n|$)/i, jobIdx: 1, companyIdx: 2 },
          { regex: /(.+?)\s+[-–—]\s+(.+?)(?:\n|$)/i, jobIdx: 1, companyIdx: 2 },
          { regex: /(.+?)\s+\|\s+(.+?)(?:\n|$)/i, jobIdx: 2, companyIdx: 1 },
          { regex: /(.+?)\s+•\s+(.+?)(?:\n|$)/i, jobIdx: 2, companyIdx: 1 }
        ];
        for (const pattern of patterns) {
          const match = allText.match(pattern.regex);
          if (match) {
            const potentialJob = cleanText(match[pattern.jobIdx]);
            const potentialCompany = cleanText(match[pattern.companyIdx]);
            if (potentialJob.length > 2 && potentialCompany.length > 2) {
              return { jobTitle: potentialJob, company: potentialCompany };
            }
          }
        }

        const companyLink = firstItem.querySelector('a[href*="/company/"]');
        if (companyLink) {
          const company = cleanText(companyLink.textContent);
          let jobTitle = '';
          const allSpans = firstItem.querySelectorAll('span');
          for (const span of allSpans) {
            const text = cleanText(span.textContent);
            if (text && text !== company && text.length > 2 && isJobTitle(text)) {
              jobTitle = text;
              break;
            }
          }
          if (company && jobTitle) return { jobTitle, company };
        }

        const allTextElements = firstItem.querySelectorAll('span, div, .t-14, .t-bold, .t-normal');
        const textContents: string[] = [];
        allTextElements.forEach(el => {
          const text = cleanText(el.textContent);
          if (text && text.length > 2 && !text.match(/^\d+$/) && !text.includes('ago') && !text.includes('·')) {
            textContents.push(text);
          }
        });
        if (textContents.length >= 2) {
          const uniqueTexts = [...new Set(textContents)];
          if (uniqueTexts.length >= 2) {
            return { jobTitle: uniqueTexts[0], company: uniqueTexts[1] };
          }
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
  // ✅ STEP 2: SCRAPE NAME, JOB TITLE, COMPANY FROM PROFILE PAGE
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

    const isAuthWall = (url: string) => {
      return url.includes('login') || url.includes('signin') || url.includes('authwall') || url.includes('checkpoint');
    };

    let retries = 3;
    let lastError: any;

    while (retries > 0) {
      try {
        console.log(`   🚶 Navigating to profile: ${profileUrl} (${retries} retries left)`);
        
        await newPage.setDefaultNavigationTimeout(60000);
        await newPage.goto(profileUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        const currentUrl = newPage.url();
        if (isAuthWall(currentUrl)) {
          console.log('   ⚠️ Redirected to login page - cookie may be expired or profile requires auth');
          const nameFromUrl = this.getNameFromUrlFallback(profileUrl);
          return {
            name: nameFromUrl,
            jobTitle: 'Not specified',
            company: 'Not specified',
            profileUrl
          };
        }

        try {
          await newPage.waitForSelector('.pv-top-card, .profile-card, .top-card-layout', {
            timeout: 15000
          });
          console.log('   ✅ Profile card loaded');
        } catch (selectorError) {
          console.log('   ⚠️ Profile card not found, waiting a bit more...');
          await this.delay(5000);
        }

        await this.delay(3000);

        // ---- MAIN EXTRACTION (TOP CARD) ----
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

          // ----- NAME -----
          const nameSelectors = [
            'h1',
            '.top-card-layout__title',
            '.pv-top-card--list .t-24',
            '.profile-card__content h1',
            '.pv-top-card-v2-section__name',
            '.inline-show-more-text',
            '[data-anonymize="person-name"]'
          ];
          
          let name = getText(nameSelectors);
          
          if (!name) {
            const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
            if (metaTitle) {
              name = metaTitle.split(' | ')[0].trim();
            }
          }
          
          if (!name) {
            const title = document.title;
            const titleMatch = title.match(/^(.+?)\s*\|\s*(?:LinkedIn|Linked In)/i);
            if (titleMatch) {
              name = titleMatch[1].trim();
            }
          }
          
          name = name || 'Not specified';

          // ----- HEADLINE -----
          const headlineSelectors = [
            '.text-body-medium',
            '.top-card-layout__headline',
            '.pv-top-card--list .pv-top-card__headline',
            '.profile-card__headline',
            '.profile-headline',
            '.pv-top-card-v2-section__headline',
            '[data-anonymize="headline"]',
            '.mt2 .text-body-medium'
          ];
          
          const headline = getText(headlineSelectors);

          // ----- COMPANY FROM BUTTON -----
          const companyButtonSelectors = [
            '.KUjVsMOGSJBXjUxWSEPApVwUXYrHVRNBGs',
            'button[aria-label*="Current company"]',
            'button[aria-label*="company"]',
            '.pv-text-details__right-panel-item-link',
            '.inline-show-more-text--full',
            '.pv-text-details__right-panel-item-text',
            '.tSUXRtrHvgJfWMazJfDcElPUMAPbdhFczmxPHw'
          ];
          
          let companyFromButton = 'Not specified';
          for (const selector of companyButtonSelectors) {
            const companyButton = document.querySelector(selector);
            if (companyButton) {
              const buttonText = companyButton.textContent?.trim();
              if (buttonText && buttonText !== 'flex' && buttonText.length > 1) {
                if (buttonText.length < 50 && !buttonText.includes('linkedin') && !buttonText.includes('profile')) {
                  companyFromButton = buttonText;
                  break;
                }
              }
              
              const ariaLabel = companyButton.getAttribute('aria-label');
              if (ariaLabel) {
                const companyMatch = ariaLabel.match(/Current company:\s*([^.]+)/i);
                if (companyMatch) {
                  companyFromButton = companyMatch[1].trim();
                  break;
                }
                
                if (ariaLabel.length < 50 && !ariaLabel.includes('linkedin')) {
                  companyFromButton = ariaLabel;
                  break;
                }
              }
            }
          }

          return { name, headline, companyFromButton };
        });

        let { name, headline, companyFromButton } = profileData;
        let jobTitle = 'Not specified';
        let company = companyFromButton; // Start with button-extracted company

        // ---- Parse headline to get job title and possibly company (with validation) ----
        if (headline && headline !== 'Not specified') {
          const separators = [' at ', ' @ ', ' · ', ' - ', ' | ', ' • ', ' / ', ' , '];
          let foundSeparator = false;
          
          for (const sep of separators) {
            if (headline.includes(sep)) {
              const parts = headline.split(sep);
              const potentialJobTitle = parts[0].trim();
              const potentialCompany = parts.slice(1).join(sep).trim();
              
              // Always use the first part as job title (it's almost always the job title)
              if (potentialJobTitle && potentialJobTitle.length > 1) {
                jobTitle = potentialJobTitle;
              }
              
              // Only use potentialCompany if it looks like a company AND we don't already have a company from button
              if (company === 'Not specified' && potentialCompany && this.looksLikeCompany(potentialCompany)) {
                company = potentialCompany;
                console.log(`   ✅ Valid company extracted from headline: "${company}"`);
              } else if (company === 'Not specified') {
                console.log(`   ⚠️ Potential company "${potentialCompany}" did not pass validation, will try other methods`);
              }
              
              foundSeparator = true;
              break;
            }
          }
          
          if (!foundSeparator && company === 'Not specified') {
            // No separator found; treat entire headline as job title
            if (headline.length > 1) {
              jobTitle = headline;
            }
          }
        }

        // Clean company from employment type suffixes
        if (company && company !== 'Not specified') {
          company = this.cleanCompany(company);
        }

        // Treat "--" as missing job title
        const jobTitleMissing = !jobTitle || jobTitle === 'Not specified' || jobTitle === '--' || jobTitle.trim() === '';
        const companyMissing = !company || company === 'Not specified' || company.trim() === '';

        // Try to extract company from headline using extractCompanyFromHeadline (which already includes validation)
        if (companyMissing && headline) {
          console.log('   🔍 Trying to extract company from headline (secondary method)...');
          const extractedCompany = this.extractCompanyFromHeadline(headline);
          if (extractedCompany) {
            company = extractedCompany;
            console.log(`   ✅ Found company in headline: "${company}"`);
          }
        }

        // ===== FALLBACK: If company or job title missing/malformed, scroll to experience section =====
        const needsExperience = 
          companyMissing || 
          jobTitleMissing || 
          (jobTitle && (jobTitle.includes(' at ') || jobTitle.includes(' @ ')));

        if (needsExperience) {
          console.log('   🔍 Company or job title missing/malformed, checking experience section...');
          const experienceData = await this.extractFromExperienceSection(newPage);
          if (experienceData) {
            if (companyMissing && experienceData.company && experienceData.company !== 'Not specified') {
              company = this.cleanCompany(experienceData.company);
            }
            if (jobTitleMissing && experienceData.jobTitle && experienceData.jobTitle !== 'Not specified') {
              jobTitle = experienceData.jobTitle;
            }
            
            // If job title still contains company info, clean it
            if (jobTitle && (jobTitle.includes(' at ') || jobTitle.includes(' @ '))) {
              jobTitle = jobTitle.split(/ at | @ /)[0].trim();
            }
          }
        }

        // Final cleanup
        if (jobTitle && (jobTitle.includes(' at ') || jobTitle.includes(' @ '))) {
          jobTitle = jobTitle.split(/ at | @ /)[0].trim();
        }

        // Ensure we don't return "--" as job title
        if (jobTitle === '--' || jobTitle?.trim() === '') {
          jobTitle = 'Not specified';
        }

        console.log(`   ✅ Extracted: "${name}" | Job: "${jobTitle}" | Company: "${company}"`);
        
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
          console.log(`   ⚠️ Retry ${3 - retries}/3 failed, waiting before next attempt...`);
          await this.delay(5000);
        }
      } finally {
        // Ensure the profile tab is closed after each attempt
        await newPage.close().catch(() => {});
      }
    }

    console.error(`   ❌ Failed to scrape ${profileUrl} after 3 attempts: ${lastError?.message}`);
    
    const nameFromUrl = this.getNameFromUrlFallback(profileUrl);
    
    return {
      name: nameFromUrl,
      jobTitle: 'Not specified',
      company: 'Not specified',
      profileUrl
    };
  }

  // Helper to extract a readable name from a profile URL
  private getNameFromUrlFallback(profileUrl: string): string {
    try {
      const urlParts = profileUrl.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart && lastPart !== 'in' && !lastPart.includes('?')) {
        if (/^[A-Z0-9]+$/.test(lastPart)) {
          return 'LinkedIn Member';
        }
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
        '.artdeco-modal__close-button',
        'button[data-control-name="overlay.close"]'
      ];
      for (const sel of closeSelectors) {
        const btn = document.querySelector(sel);
        if (btn) {
          (btn as HTMLElement).click();
          break;
        }
      }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    await this.delay(2000);
  }

  // ==========================================================================
  // ✅ DEBUG URLS FUNCTION
  // ==========================================================================
  private async debugUrls(profileUrls: any[]): Promise<void> {
    console.log('\n🔍 DEBUGGING URLS:');
    for (let i = 0; i < Math.min(profileUrls.length, 5); i++) {
      const url = profileUrls[i].profileUrl;
      console.log(`URL ${i+1}: ${url}`);
      
      const isValidProfileUrl = url.includes('/in/') && !url.includes('miniProfile') && !url.includes('?') && !url.includes('urn');
      console.log(`   Valid profile URL: ${isValidProfileUrl ? '✅' : '❌'}`);
      
      if (!isValidProfileUrl) {
        const match = url.match(/urn:li:fs_miniProfile:([a-zA-Z0-9]+)/);
        if (match) {
          const actualProfileUrl = `https://www.linkedin.com/in/${match[1]}/`;
          console.log(`   Try this instead: ${actualProfileUrl}`);
        }
      }
    }
  }

  // ==========================================================================
  // ✅ MAIN SCRAPING FUNCTION
  // ==========================================================================
  async scrapeProfileActivity(
    profileUrl: string,
    maxLikes: number = 50
  ): Promise<ScrapeResult> {
    if (!this.browser || !this.page) {
      throw new Error('Scraper not initialized');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 STARTING SCRAPING - VISITING EACH PROFILE PAGE');
    console.log('='.repeat(60));
    console.log(`🔗 Target profile: ${profileUrl}`);
    console.log(`🎯 Max profiles to process: ${maxLikes}`);

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
      console.log('\n1️⃣  On profile page...');
      await this.delay(2000);

      console.log('\n2️⃣  Starting auto-scroll...');
      await this.autoScrollToLoadPosts();

      console.log('\n3️⃣  Finding like count buttons...');
      const likeButtons = await this.findLikeButtons();

      if (likeButtons.length === 0) {
        result.error = 'No like buttons found';
        console.log('❌ No like buttons found');
        return result;
      }

      console.log(`✅ Found ${likeButtons.length} posts with likes`);

      const button = likeButtons[0];
      console.log(`\n📝 Processing post: ${button.author} (${button.likesCount} likes)`);

      if (!(await this.clickLikeButton(button.index))) {
        result.error = 'Could not open likes modal';
        return result;
      }

      const profileUrls = await this.extractProfileUrlsFromModal(
        button.author,
        button.likesCount,
        maxLikes
      );

      await this.debugUrls(profileUrls);

      if (profileUrls.length === 0) {
        result.error = 'No profile URLs found in likes modal';
        return result;
      }

      console.log(`\n📋 Found ${profileUrls.length} unique profile URLs in modal.`);

      await this.closeModal();

      console.log(`\n👥 Visiting ${profileUrls.length} profile pages to extract data...`);

      const enrichedProfiles: LikeData[] = [];
      const DELAY_BETWEEN_PROFILES = 6000;

      for (let i = 0; i < Math.min(profileUrls.length, maxLikes); i++) {
        const profile = profileUrls[i];
        console.log(`\n👤 [${i + 1}/${Math.min(profileUrls.length, maxLikes)}] Processing ${profile.name}`);

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
          console.log(`   ⏳ Waiting ${DELAY_BETWEEN_PROFILES / 1000}s before next...`);
          await this.delay(DELAY_BETWEEN_PROFILES);
        }
      }

      result.data.likes = enrichedProfiles;
      result.data.posts = likeButtons.slice(0, 1).map(btn => ({
        author: btn.author,
        authorProfileUrl: btn.authorProfileUrl || '',
        content: btn.text || `Post with ${btn.likesCount} likes`,
        postUrl: '',
        postedAt: new Date().toISOString(),
        likesCount: btn.likesCount,
        commentsCount: 0
      }));

      result.success = true;
      result.stats = {
        totalProfiles: result.data.likes.length,
        totalPosts: result.data.posts.length,
        totalComments: 0,
        extractionTime: 0
      };

      console.log('\n' + '='.repeat(80));
      console.log('🎉 SCRAPING COMPLETE!');
      console.log('='.repeat(80));
      console.log(`✅ Total profiles extracted: ${result.data.likes.length} / ${maxLikes} requested`);

      if (result.data.likes.length > 0) {
        console.log('\n📋 FINAL DATA:');
        console.log('='.repeat(80));
        result.data.likes.forEach((p, i) => {
          console.log(
            `${i + 1}. ${p.name} | Job: ${p.jobTitle} | Company: ${p.company} | URL: ${p.profileUrl}`
          );
        });
        console.log('='.repeat(80));
      }

      return result;
    } catch (error: any) {
      console.error('\n❌ SCRAPING ERROR:', error.message);
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