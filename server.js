const express = require('express');
const cors = require('cors');
const path = require('path');
const Snoowrap = require('snoowrap');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const r = new Snoowrap({
  userAgent: 'RedditIntelligenceBot/1.0',
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD,
});

app.use(express.static('.'));

// Advanced signal patterns with weighted scoring
const signalPatterns = {
  hire: {
    direct: [
      { phrase: 'looking to hire', weight: 30 },
      { phrase: 'hiring', weight: 25 },
      { phrase: 'need a designer', weight: 35 },
      { phrase: 'need developer', weight: 35 },
      { phrase: 'freelancer needed', weight: 30 },
      { phrase: 'contractor wanted', weight: 28 },
      { phrase: 'looking for someone', weight: 20 },
      { phrase: 'seeking designer', weight: 32 },
      { phrase: 'recruiting', weight: 25 },
      { phrase: 'talent acquisition', weight: 22 }
    ],
    indirect: [
      { phrase: 'recommendations for', weight: 15 },
      { phrase: 'who can help', weight: 18 },
      { phrase: 'looking for help', weight: 16 },
      { phrase: 'need someone', weight: 20 },
      { phrase: 'where to find', weight: 12 },
      { phrase: 'suggestions for', weight: 14 },
      { phrase: 'anyone know', weight: 10 },
      { phrase: 'point me towards', weight: 12 }
    ],
    project: [
      { phrase: 'working on', weight: 8 },
      { phrase: 'building', weight: 12 },
      { phrase: 'creating', weight: 10 },
      { phrase: 'developing', weight: 14 },
      { phrase: 'starting', weight: 16 },
      { phrase: 'launching', weight: 18 }
    ],
    pain: [
      { phrase: 'struggling with', weight: 25 },
      { phrase: 'having trouble', weight: 22 },
      { phrase: 'need help with', weight: 20 },
      { phrase: 'stuck on', weight: 24 },
      { phrase: 'frustrated with', weight: 26 },
      { phrase: 'can\'t figure out', weight: 20 }
    ]
  },
  budget: {
    explicit: [
      { phrase: '$', weight: 25 },
      { phrase: '€', weight: 25 },
      { phrase: '£', weight: 25 },
      { phrase: 'budget', weight: 30 },
      { phrase: 'pay', weight: 20 },
      { phrase: 'cost', weight: 15 },
      { phrase: 'price', weight: 18 },
      { phrase: 'rate', weight: 22 },
      { phrase: 'salary', weight: 28 },
      { phrase: 'fee', weight: 20 },
      { phrase: 'compensation', weight: 25 }
    ],
    range: [
      { phrase: 'k', weight: 20 },
      { phrase: '000', weight: 18 },
      { phrase: 'thousand', weight: 22 },
      { phrase: 'per hour', weight: 25 },
      { phrase: '/hr', weight: 25 },
      { phrase: 'hourly', weight: 24 },
      { phrase: 'fixed price', weight: 20 },
      { phrase: 'project basis', weight: 18 },
      { phrase: 'retainer', weight: 26 }
    ],
    context: [
      { phrase: 'investment', weight: 22 },
      { phrase: 'funding', weight: 24 },
      { phrase: 'afford', weight: 18 },
      { phrase: 'spend', weight: 16 },
      { phrase: 'allocated', weight: 20 },
      { phrase: 'approved budget', weight: 30 },
      { phrase: 'financial backing', weight: 25 }
    ],
    signals: [
      { phrase: 'serious about', weight: 15 },
      { phrase: 'ready to invest', weight: 25 },
      { phrase: 'quality work', weight: 12 },
      { phrase: 'professional', weight: 10 },
      { phrase: 'not looking for cheap', weight: 20 }
    ]
  },
  urgent: {
    immediate: [
      { phrase: 'asap', weight: 30 },
      { phrase: 'urgent', weight: 28 },
      { phrase: 'immediately', weight: 32 },
      { phrase: 'right now', weight: 30 },
      { phrase: 'emergency', weight: 35 },
      { phrase: 'rush', weight: 25 },
      { phrase: 'quickly', weight: 20 }
    ],
    timebound: [
      { phrase: 'deadline', weight: 25 },
      { phrase: 'by friday', weight: 28 },
      { phrase: 'this week', weight: 26 },
      { phrase: 'next week', weight: 24 },
      { phrase: 'launch date', weight: 22 },
      { phrase: 'timeline', weight: 20 },
      { phrase: 'schedule', weight: 18 },
      { phrase: 'time sensitive', weight: 24 }
    ],
    pressure: [
      { phrase: 'behind schedule', weight: 26 },
      { phrase: 'need fast', weight: 22 },
      { phrase: 'quick turnaround', weight: 24 },
      { phrase: 'running out of time', weight: 28 }
    ]
  },
  decision: {
    authority: [
      { phrase: 'i am the', weight: 25 },
      { phrase: 'ceo', weight: 30 },
      { phrase: 'founder', weight: 28 },
      { phrase: 'owner', weight: 26 },
      { phrase: 'decision maker', weight: 30 },
      { phrase: 'co-founder', weight: 28 },
      { phrase: 'startup founder', weight: 32 },
      { phrase: 'business owner', weight: 25 }
    ],
    responsibility: [
      { phrase: 'my company', weight: 20 },
      { phrase: 'our startup', weight: 22 },
      { phrase: 'i need', weight: 15 },
      { phrase: 'we need', weight: 12 },
      { phrase: 'my business', weight: 18 },
      { phrase: 'our team', weight: 14 }
    ],
    ownership: [
      { phrase: 'my project', weight: 16 },
      { phrase: 'working on my', weight: 14 },
      { phrase: 'building my', weight: 16 },
      { phrase: 'starting my', weight: 18 }
    ]
  },
  strategic: {
    scaling: [
      { phrase: 'scaling', weight: 22 },
      { phrase: 'growth', weight: 18 },
      { phrase: 'expand', weight: 20 },
      { phrase: 'growing fast', weight: 24 },
      { phrase: 'scale up', weight: 22 },
      { phrase: 'next level', weight: 20 }
    ],
    pivoting: [
      { phrase: 'pivot', weight: 25 },
      { phrase: 'change direction', weight: 22 },
      { phrase: 'new strategy', weight: 20 },
      { phrase: 'rebranding', weight: 24 },
      { phrase: 'repositioning', weight: 22 }
    ],
    launching: [
      { phrase: 'launch', weight: 20 },
      { phrase: 'go to market', weight: 25 },
      { phrase: 'pre-launch', weight: 22 },
      { phrase: 'beta', weight: 15 },
      { phrase: 'mvp', weight: 18 },
      { phrase: 'minimum viable', weight: 16 }
    ],
    improving: [
      { phrase: 'redesign', weight: 18 },
      { phrase: 'refresh', weight: 15 },
      { phrase: 'update', weight: 12 },
      { phrase: 'modernize', weight: 16 },
      { phrase: 'improve', weight: 14 },
      { phrase: 'enhance', weight: 16 }
    ]
  },
  competitor: {
    dissatisfaction: [
      { phrase: 'disappointed with', weight: 25 },
      { phrase: 'bad experience', weight: 28 },
      { phrase: 'terrible service', weight: 30 },
      { phrase: 'unhappy with', weight: 24 },
      { phrase: 'looking for alternative', weight: 26 },
      { phrase: 'fed up with', weight: 28 }
    ],
    comparison: [
      { phrase: 'better than', weight: 18 },
      { phrase: 'alternative to', weight: 20 },
      { phrase: 'compared to', weight: 15 },
      { phrase: 'instead of', weight: 16 },
      { phrase: 'rather than', weight: 14 }
    ],
    switching: [
      { phrase: 'switching from', weight: 22 },
      { phrase: 'moving away from', weight: 20 },
      { phrase: 'leaving', weight: 18 },
      { phrase: 'done with', weight: 24 }
    ]
  },
  quality: {
    premium: [
      { phrase: 'high quality', weight: 18 },
      { phrase: 'professional', weight: 15 },
      { phrase: 'top notch', weight: 20 },
      { phrase: 'excellent', weight: 16 },
      { phrase: 'best', weight: 12 },
      { phrase: 'premium', weight: 22 }
    ],
    experience: [
      { phrase: 'experienced', weight: 16 },
      { phrase: 'expert', weight: 18 },
      { phrase: 'skilled', weight: 14 },
      { phrase: 'talented', weight: 12 },
      { phrase: 'proven', weight: 16 },
      { phrase: 'senior', weight: 15 }
    ],
    portfolio: [
      { phrase: 'portfolio', weight: 14 },
      { phrase: 'examples', weight: 12 },
      { phrase: 'previous work', weight: 16 },
      { phrase: 'case studies', weight: 18 },
      { phrase: 'references', weight: 15 }
    ]
  }
};

// Enhanced pattern matching with fuzzy logic
function analyzeContent(text, patterns) {
  if (!text) return { score: 0, matches: [] };
  
  const lowerText = text.toLowerCase();
  let score = 0;
  const matches = [];
  
  Object.entries(patterns).forEach(([category, subcategories]) => {
    Object.entries(subcategories).forEach(([subcat, items]) => {
      items.forEach(item => {
        const phrase = item.phrase.toLowerCase();
        const weight = item.weight;
        
        // Exact match gets full weight
        if (lowerText.includes(phrase)) {
          score += weight;
          matches.push({ phrase, weight, category, subcat });
          return;
        }
        
        // Fuzzy matching for partial phrases
        const words = phrase.split(' ');
        const matchedWords = words.filter(word => lowerText.includes(word));
        if (matchedWords.length >= Math.ceil(words.length * 0.7)) {
          const partialWeight = Math.round(weight * (matchedWords.length / words.length));
          score += partialWeight;
          matches.push({ phrase, weight: partialWeight, category, subcat, partial: true });
        }
      });
    });
  });
  
  return { score, matches };
}

// Analyze both post and top comments
async function analyzePostAndComments(post) {
  try {
    // Get top comments (limit to avoid rate limiting)
    const comments = await post.comments.slice(0, 10);
    
    let commentAnalysis = { score: 0, matches: [], insights: [] };
    
    for (const comment of comments) {
      if (comment.body && comment.body !== '[deleted]' && comment.score > 1) {
        const analysis = analyzeContent(comment.body, signalPatterns);
        commentAnalysis.score += analysis.score * 0.3; // Comments get 30% weight
        commentAnalysis.matches.push(...analysis.matches);
        
        // Check for hiring responses in comments
        if (analysis.matches.some(m => m.category === 'hire')) {
          commentAnalysis.insights.push('💬 Hiring discussion in comments');
        }
      }
    }
    
    return commentAnalysis;
  } catch (error) {
    console.log('Error analyzing comments:', error.message);
    return { score: 0, matches: [], insights: [] };
  }
}

// Enhanced priority scoring with comment analysis
function calculatePriorityScore(post, postAnalysis, commentAnalysis = null) {
  let score = 0;
  
  // Base engagement (reduced weight to focus on content quality)
  score += Math.min(post.score / 15, 15);
  score += Math.min(post.num_comments / 8, 12);
  
  // Content analysis score (primary factor)
  score += postAnalysis.score;
  
  // Comment analysis bonus
  if (commentAnalysis) {
    score += commentAnalysis.score;
  }
  
  // Quality multipliers
  const hasDirectHire = postAnalysis.matches.some(m => 
    m.category === 'hire' && m.subcat === 'direct'
  );
  const hasBudget = postAnalysis.matches.some(m => m.category === 'budget');
  const hasUrgency = postAnalysis.matches.some(m => m.category === 'urgent');
  const hasAuthority = postAnalysis.matches.some(m => 
    m.category === 'decision' && m.subcat === 'authority'
  );
  
  // Combo bonuses
  if (hasDirectHire && hasBudget) score += 25;
  if (hasAuthority && hasUrgency) score += 20;
  if (hasDirectHire && hasUrgency) score += 15;
  
  // Title relevance bonus
  const titleAnalysis = analyzeContent(post.title, signalPatterns);
  if (titleAnalysis.score > 0) score += titleAnalysis.score * 0.5;
  
  // Engagement quality bonus
  if (post.upvote_ratio > 0.8) score += 5;
  if (post.num_comments > post.score * 0.1) score += 8; // High comment-to-upvote ratio
  
  return Math.min(Math.round(score), 100);
}

// Enhanced signal detection
function detectSignals(postAnalysis, commentAnalysis = null) {
  const allMatches = [...postAnalysis.matches];
  if (commentAnalysis) {
    allMatches.push(...commentAnalysis.matches);
  }
  
  return {
    hire: allMatches.some(m => m.category === 'hire'),
    budget: allMatches.some(m => m.category === 'budget'),
    urgent: allMatches.some(m => m.category === 'urgent'),
    strategic: allMatches.some(m => m.category === 'strategic'),
    decision: allMatches.some(m => m.category === 'decision'),
    competitor: allMatches.some(m => m.category === 'competitor'),
    quality: allMatches.some(m => m.category === 'quality')
  };
}

// Enhanced categorization
function categorizePost(score) {
  if (score >= 65) return 'hot';
  if (score >= 35) return 'warm';
  return 'cold';
}

// Advanced insight generation
function generateInsights(post, signals, postAnalysis, commentAnalysis = null) {
  const insights = [];
  const allMatches = [...postAnalysis.matches];
  if (commentAnalysis) allMatches.push(...commentAnalysis.matches);
  
  // Primary insights
  if (signals.hire && signals.budget) {
    insights.push('💰 Ready to hire with budget signals');
  }
  if (signals.decision && signals.urgent) {
    insights.push('⚡ Decision maker expressing urgency');
  }
  if (signals.strategic && signals.hire) {
    insights.push('🚀 Strategic growth hiring opportunity');
  }
  if (signals.competitor && signals.hire) {
    insights.push('🎯 Competitor dissatisfaction + hiring intent');
  }
  if (signals.quality && signals.budget) {
    insights.push('💎 Quality-focused client with budget');
  }
  
  // Engagement insights
  if (post.num_comments > 15) {
    insights.push('🗣️ High engagement thread');
  }
  if (post.score > 100) {
    insights.push('📈 Viral post with visibility');
  }
  if (post.upvote_ratio > 0.9) {
    insights.push('👍 Highly positive reception');
  }
  
  // Authority insights
  const hasFounder = allMatches.some(m => 
    m.phrase.includes('founder') || m.phrase.includes('ceo')
  );
  if (hasFounder) {
    insights.push('👑 C-level executive posting');
  }
  
  // Pain point insights
  const hasPain = allMatches.some(m => m.category === 'hire' && m.subcat === 'pain');
  if (hasPain) {
    insights.push('🎯 Expressing clear pain points');
  }
  
  // Timeline insights
  const hasDeadline = allMatches.some(m => 
    m.phrase.includes('deadline') || m.phrase.includes('asap')
  );
  if (hasDeadline) {
    insights.push('⏰ Time-sensitive opportunity');
  }
  
  // Comment insights
  if (commentAnalysis && commentAnalysis.insights.length > 0) {
    insights.push(...commentAnalysis.insights);
  }
  
  return insights;
}

// Enhanced keyword matching
function hasRelevantKeywords(content, keywordList) {
  if (!keywordList || keywordList.length === 0) return true;
  
  const lowerContent = content.toLowerCase();
  
  return keywordList.some(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    
    // Exact phrase match
    if (lowerContent.includes(lowerKeyword)) return true;
    
    // Individual word matching for multi-word keywords
    const keywordWords = lowerKeyword.split(' ');
    if (keywordWords.length > 1) {
      const matchedWords = keywordWords.filter(word => lowerContent.includes(word));
      return matchedWords.length >= Math.ceil(keywordWords.length * 0.7);
    }
    
    // Partial word matching for single words (minimum 4 characters)
    if (lowerKeyword.length >= 4) {
      return lowerContent.includes(lowerKeyword.slice(0, -1));
    }
    
    return false;
  });
}

app.get('/api/posts', async (req, res) => {
  console.log('🔍 Enhanced API request received:', req.query);
  
  const { subreddits, keywords, minScore = 1 } = req.query;
  const subList = subreddits?.split(',').map(s => s.trim()) || [];
  const keywordList = keywords?.split(',').map(k => k.trim()) || [];
  let allPosts = [];

  try {
    console.log(`🎯 Analyzing ${subList.length} subreddits for ${keywordList.length} keywords`);
    
    for (const sub of subList) {
      console.log(`📊 Processing r/${sub}...`);
      
      try {
        // Fetch multiple post types
        const [hot, fresh, rising, top] = await Promise.all([
          r.getSubreddit(sub).getHot({ limit: 75 }),
          r.getSubreddit(sub).getNew({ limit: 50 }),
          r.getSubreddit(sub).getRising({ limit: 25 }),
          r.getSubreddit(sub).getTop({ time: 'week', limit: 25 })
        ]);
        
        const posts = [...hot, ...fresh, ...rising, ...top];
        console.log(`📈 Found ${posts.length} posts in r/${sub}`);

        for (const post of posts) {
          try {
            const content = `${post.title} ${post.selftext || ''}`;
            
            // Enhanced keyword filtering
            if (!hasRelevantKeywords(content, keywordList)) continue;
            if (post.score < parseInt(minScore)) continue;
            if (post.removed || post.author.name === '[deleted]') continue;

            // Analyze post content
            const postAnalysis = analyzeContent(content, signalPatterns);
            
            // Analyze comments for high-potential posts
            let commentAnalysis = null;
            if (postAnalysis.score > 20 || post.num_comments > 5) {
              commentAnalysis = await analyzePostAndComments(post);
            }

            const priorityScore = calculatePriorityScore(post, postAnalysis, commentAnalysis);
            const signals = detectSignals(postAnalysis, commentAnalysis);
            const category = categorizePost(priorityScore);
            const insights = generateInsights(post, signals, postAnalysis, commentAnalysis);

            // Only include posts with some relevance
            if (priorityScore < 10 && !signals.hire) continue;

            allPosts.push({
              title: post.title,
              excerpt: post.selftext?.slice(0, 600) || '',
              subreddit: post.subreddit.display_name,
              score: post.score,
              comments: post.num_comments,
              date: new Date(post.created_utc * 1000).toISOString().split('T')[0],
              url: `https://reddit.com${post.permalink}`,
              priorityScore,
              category,
              signals,
              insights,
              author: post.author.name,
              upvoteRatio: post.upvote_ratio || 0,
              matchedSignals: postAnalysis.matches.length + (commentAnalysis?.matches.length || 0),
              hasCommentAnalysis: !!commentAnalysis,
              timeAgo: getTimeAgo(post.created_utc)
            });
          } catch (postError) {
            console.log(`⚠️ Error processing post: ${postError.message}`);
            continue;
          }
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (subError) {
        console.log(`❌ Error with r/${sub}: ${subError.message}`);
        continue;
      }
    }

    // Enhanced deduplication and sorting
    const unique = allPosts
      .filter((p, i, self) => i === self.findIndex(q => q.url === p.url))
      .sort((a, b) => {
        // Prioritize high-scoring posts with hire signals
        if (a.signals.hire && !b.signals.hire) return -1;
        if (!a.signals.hire && b.signals.hire) return 1;
        return b.priorityScore - a.priorityScore;
      });
    
    console.log(`✅ Returning ${unique.length} qualified leads`);
    
    // Enhanced stats
    const stats = {
      total: unique.length,
      hot: unique.filter(p => p.category === 'hot').length,
      warm: unique.filter(p => p.category === 'warm').length,
      cold: unique.filter(p => p.category === 'cold').length,
      withBudgetSignals: unique.filter(p => p.signals.budget).length,
      withHireSignals: unique.filter(p => p.signals.hire).length,
      withUrgentSignals: unique.filter(p => p.signals.urgent).length,
      decisionMakers: unique.filter(p => p.signals.decision).length,
      averageScore: Math.round(unique.reduce((sum, p) => sum + p.priorityScore, 0) / unique.length) || 0,
      withCommentAnalysis: unique.filter(p => p.hasCommentAnalysis).length
    };
    
    res.json({ posts: unique, stats });

  } catch (err) {
    console.error('💥 API Error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch Reddit posts', 
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

function getTimeAgo(timestamp) {
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Enhanced health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    version: '2.0-enhanced',
    timestamp: new Date().toISOString(),
    features: ['comment-analysis', 'fuzzy-matching', 'advanced-scoring']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Enhanced Reddit Intelligence API v2.0 running on http://localhost:${PORT}`);
  console.log(`📊 Features: Advanced scoring, comment analysis, fuzzy matching`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});