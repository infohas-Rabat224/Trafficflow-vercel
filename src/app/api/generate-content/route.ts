import { NextResponse, NextRequest } from "next/server";

// AI API Configuration
const AI_CONFIG = {
  baseUrl: process.env.Z_AI_BASE_URL || 'https://api.z-ai.dev/v1',
  apiKey: process.env.Z_AI_API_KEY || '',
};

// Check if AI API is configured
function isAIConfigured(): boolean {
  return !!(AI_CONFIG.apiKey && AI_CONFIG.apiKey.length > 10);
}

// Direct AI API call
async function callAIAPI(prompt: string, systemPrompt: string, maxTokens: number = 2000): Promise<{ content: string | null; error: string | null; debug?: any }> {
  try {
    const requestBody = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' }
    };

    console.log('Calling AI API for content generation...');
    
    const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'X-Z-AI-From': 'Z',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('AI API response status:', response.status);

    if (!response.ok) {
      return { 
        content: null, 
        error: `API error ${response.status}: ${responseText.substring(0, 200)}`,
        debug: { status: response.status, body: responseText.substring(0, 500) }
      };
    }

    const data = JSON.parse(responseText);
    const content = data.choices?.[0]?.message?.content || null;
    
    return { 
      content, 
      error: content ? null : 'No content in response',
      debug: { hasChoices: !!data.choices, choicesLength: data.choices?.length }
    };
  } catch (error: any) {
    console.error('AI API call failed:', error);
    return { content: null, error: error.message };
  }
}

// Fallback content generator for when AI is unavailable
function generateFallbackContent(topic: string, type: string, tone: string): string {
  const templates: Record<string, (t: string, tone: string) => string> = {
    blog: (t, tone) => `# ${t}: A Comprehensive Guide

${tone === 'professional' ? 'In this comprehensive article, we explore the key aspects of' : tone === 'casual' ? "Let's dive into" : `Discover everything you need to know about`} ${t}.

## Introduction

Understanding ${t} is essential for anyone looking to improve their digital presence. This guide will walk you through the fundamentals and advanced strategies that will help you achieve remarkable results in today's competitive landscape.

## Why ${t} Matters

The digital landscape is constantly evolving, and staying ahead requires a deep understanding of ${t}. Businesses and individuals who master these concepts consistently outperform their competitors and achieve sustainable growth.

### Key Statistics

- 93% of online experiences begin with search engines
- 75% of users never scroll past the first page of search results
- Companies that blog receive 97% more links to their website
- Content marketing costs 62% less than traditional marketing

## Core Strategies for Success

### 1. Foundation Building
Start with a solid understanding of your target audience and their needs. Research thoroughly and create content that addresses real pain points.

### 2. Implementation Excellence
Execute your strategies with precision and consistency. Monitor results and adjust your approach based on data-driven insights.

### 3. Continuous Optimization
Never stop improving. Use analytics to identify opportunities and refine your tactics for better performance over time.

## Best Practices

When implementing ${t} strategies, consider these essential tips:

- **Research First**: Understand your audience and competition before taking action
- **Quality Over Quantity**: Focus on creating valuable, comprehensive content
- **Data-Driven Decisions**: Let analytics guide your optimization efforts
- **Consistency**: Maintain a regular schedule for maximum impact

## Common Mistakes to Avoid

1. Neglecting mobile optimization
2. Ignoring user experience signals
3. Focusing solely on keywords rather than user intent
4. Underestimating the power of internal linking

## Advanced Techniques

For those ready to take their ${t} efforts to the next level, consider:

- Implementing schema markup for rich snippets
- Creating comprehensive pillar content
- Building a strategic internal linking structure
- Leveraging AI and automation tools

## Measuring Success

Track these key metrics to evaluate your ${t} effectiveness:

- Organic traffic growth
- Search ranking improvements
- Engagement metrics (time on page, bounce rate)
- Conversion rates
- Backlink acquisition

## Conclusion

${t} remains a crucial element of any successful digital strategy. By following the guidelines in this article and staying committed to continuous improvement, you'll be well-positioned to achieve your goals and maintain a competitive edge.

---

*This content was generated by TrafficFlow AI Content Generator*`,

    product: (t, tone) => `**${t}** - Premium Quality Solution

${tone === 'professional' ? 'Elevate your business with our' : 'Discover our'} exceptional ${t} solution, designed to meet your specific needs and exceed your expectations.

### Features:
- ✓ Premium quality and reliability
- ✓ Expert-backed methodology  
- ✓ Proven results across industries
- ✓ Dedicated support team
- ✓ Regular updates and improvements

### Why Choose Us?
Our ${t} solution stands out for its quality, effectiveness, and customer satisfaction. We've helped hundreds of businesses achieve their goals through our innovative approach and commitment to excellence.

**Key Benefits:**
- Increase efficiency by up to 40%
- Reduce operational costs
- Improve customer satisfaction
- Scale your operations seamlessly

### What Our Customers Say:
"This solution transformed our business operations completely." - Satisfied Customer

### Pricing:
Contact us for custom pricing tailored to your needs. We offer flexible plans to suit businesses of all sizes.

*Order now and transform your business with ${t}!*`,

    landing: (t, tone) => `# Transform Your Business with ${t}

${tone === 'professional' ? 'Welcome to the future of' : 'Ready to master'} ${t}? You're in the right place.

## What We Offer

✓ Expert guidance on ${t}
✓ Proven strategies that deliver results
✓ Personalized approach for your business
✓ Ongoing support and optimization

## Our Process

### 1. Discovery
We analyze your current situation, identify opportunities, and understand your goals.

### 2. Strategy
We develop a custom ${t} plan tailored to your specific needs and objectives.

### 3. Implementation
We execute with precision, keeping you informed every step of the way.

### 4. Results
You see measurable improvements in your key performance indicators.

## Why Choose Us?

- **10+ Years Experience** in ${t} solutions
- **500+ Happy Clients** who achieved their goals
- **24/7 Support** whenever you need assistance
- **Money-Back Guarantee** - your satisfaction is our priority

## Get Started Today

Don't wait to improve your ${t} strategy. Join thousands of successful businesses who have transformed their operations with our help.

**[Get Started] [Learn More] [Contact Us]**`,

    meta: (t, tone) => `${t} - Comprehensive Guide & Expert Tips | Your Brand

Discover expert insights on ${t}. Learn best practices, strategies, and tips to improve your results. Free consultation available.`,

    social: (t, tone) => `🚀 ${t} - The Ultimate Guide!

${tone === 'casual' ? "Looking to level up your" : 'Master'} ${t} with our expert tips! 📈

✅ Proven strategies
✅ Easy implementation  
✅ Real results
✅ Step-by-step guidance

Click the link to learn more! 👇

#${t.replace(/\s+/g, '')} #DigitalMarketing #SEO #Growth #Tips #Strategy`
  };

  return templates[type]?.(topic, tone) || templates.blog(topic, tone);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, type, tone } = body;

    if (!topic) {
      return NextResponse.json({ 
        error: 'Topic is required',
        success: false 
      }, { status: 400 });
    }

    // Try AI Content Generation
    let content = '';
    let usedAI = false;
    let aiError: string | null = null;

    const typePrompts: Record<string, string> = {
      blog: 'Write a comprehensive, SEO-optimized blog post',
      product: 'Write a compelling, conversion-focused product description',
      landing: 'Write high-converting landing page copy',
      meta: 'Write a SEO meta description (under 160 characters) that includes the main keyword',
      social: 'Write an engaging social media post with emojis and hashtags'
    };

    const toneInstructions: Record<string, string> = {
      professional: 'Use a professional, authoritative tone suitable for business audiences',
      casual: 'Use a casual, friendly, conversational tone',
      technical: 'Use a technical, detailed tone with industry-specific terminology',
      friendly: 'Use a warm, approachable, and encouraging tone'
    };

    const wordCountGuide: Record<string, string> = {
      blog: 'The post should be approximately 800-1200 words with clear headings.',
      product: 'Keep it concise but compelling, around 150-250 words.',
      landing: 'Focus on benefits and call-to-actions, around 300-500 words.',
      meta: 'Must be under 160 characters total.',
      social: 'Keep it under 280 characters for Twitter compatibility.'
    };

    const prompt = `${typePrompts[type || 'blog']} about "${topic}". 

${toneInstructions[tone || 'professional']}.

${wordCountGuide[type || 'blog']}

Requirements:
- Make it SEO-optimized with relevant keywords naturally integrated
- Include engaging headings and clear structure where applicable
- Make it valuable and actionable for readers
- Include a strong opening that hooks the reader
- End with a clear call-to-action or conclusion`;

    const systemPrompt = 'You are an expert SEO content writer with 10+ years of experience. Create high-quality, engaging content that ranks well in search engines and converts readers. Your content is always well-structured, original, and provides real value to the target audience.';
    
    const maxTokens = type === 'meta' ? 100 : type === 'social' ? 300 : 2000;

    // Try real AI generation if configured
    if (isAIConfigured()) {
      try {
        const result = await callAIAPI(prompt, systemPrompt, maxTokens);
        
        if (result.content && result.content.length > 50) {
          content = result.content;
          usedAI = true;
        } else {
          aiError = result.error || 'AI returned insufficient content';
        }
      } catch (err: any) {
        aiError = err?.message || 'Unknown AI error';
        console.error('AI generation error:', aiError);
      }
    } else {
      aiError = 'AI API key not configured';
    }

    // If AI failed or not configured, use enhanced fallback
    if (!content || content.length < 10) {
      content = generateFallbackContent(topic, type || 'blog', tone || 'professional');
    }
    
    return NextResponse.json({ 
      success: true, 
      content,
      type: type || 'blog',
      topic,
      generatedAt: new Date().toISOString(),
      method: usedAI ? 'ai' : 'template',
      wordCount: content.split(/\s+/).length,
      aiConfigured: isAIConfigured(),
      ...(aiError && !usedAI ? { aiError, note: 'Used template fallback - configure Z_AI_API_KEY for real AI generation' } : {})
    });
  } catch (error: any) {
    console.error('API Error:', error);
    
    return NextResponse.json({ 
      error: 'Failed to generate content',
      message: error.message,
      success: false
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: "TrafficFlow AI Content Generator API - Active",
    version: "2.1",
    configured: isAIConfigured(),
    endpoints: {
      POST: "/api/generate-content - Generate AI content"
    },
    setup: {
      required: ['Z_AI_API_KEY'],
      optional: ['Z_AI_BASE_URL']
    },
    contentTypes: ['blog', 'product', 'landing', 'meta', 'social'],
    tones: ['professional', 'casual', 'technical', 'friendly']
  });
}
