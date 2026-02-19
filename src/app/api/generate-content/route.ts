import { NextResponse, NextRequest } from "next/server";

/**
 * AI Content Generator API
 * 
 * Uses z-ai-web-dev-sdk for real AI content generation
 * Generates unique content based on topic, type, and tone
 */

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

    const contentType = type || 'blog';
    const contentTone = tone || 'professional';

    // Build content-specific prompts
    const typePrompts: Record<string, { instruction: string; format: string; length: string }> = {
      blog: {
        instruction: 'Write a comprehensive, SEO-optimized blog post',
        format: 'Use markdown formatting with H1, H2, H3 headings. Include an introduction, 3-5 main sections with subsections, and a conclusion.',
        length: '800-1200 words'
      },
      product: {
        instruction: 'Write a compelling, conversion-focused product description',
        format: 'Include a catchy headline, key features as bullet points, benefits, social proof elements, and a strong call-to-action.',
        length: '150-300 words'
      },
      landing: {
        instruction: 'Write high-converting landing page copy',
        format: 'Include a powerful headline, value proposition, key benefits, feature highlights, testimonials placeholder, and multiple CTAs.',
        length: '300-500 words'
      },
      meta: {
        instruction: 'Write a SEO meta description',
        format: 'Single paragraph, no headings. Make it compelling to encourage clicks.',
        length: 'under 160 characters total'
      },
      social: {
        instruction: 'Write an engaging social media post',
        format: 'Use emojis, hashtags, and a conversational style. Include a hook, value proposition, and call-to-action.',
        length: 'under 280 characters for Twitter, can be longer for other platforms'
      }
    };

    const toneInstructions: Record<string, string> = {
      professional: 'Use a professional, authoritative tone suitable for business audiences. Be clear, concise, and credible.',
      casual: 'Use a casual, friendly, conversational tone. Write like you are talking to a friend.',
      technical: 'Use a technical, detailed tone with industry-specific terminology. Be precise and comprehensive.',
      friendly: 'Use a warm, approachable, and encouraging tone. Be supportive and positive.'
    };

    const typeConfig = typePrompts[contentType];
    
    const systemPrompt = `You are an expert SEO content writer with 10+ years of experience. Create high-quality, engaging content that ranks well in search engines and converts readers. 

Your content is always:
- Well-structured and easy to read
- Original and provides real value
- Optimized for search engines
- Tailored to the specified tone and format
- Actionable and practical

You never repeat generic phrases or use filler content. Every sentence serves a purpose.`;

    const userPrompt = `${typeConfig.instruction} about "${topic}".

TONE: ${toneInstructions[contentTone]}

FORMAT: ${typeConfig.format}

LENGTH: ${typeConfig.length}

ADDITIONAL REQUIREMENTS:
- Make the content completely unique and specific to "${topic}"
- Include specific examples, statistics, or case studies where appropriate
- Ensure all advice is actionable and practical
- Use natural language that appeals to both readers and search engines
- Avoid generic phrases like "in today's digital landscape" or "it goes without saying"
- Make the opening sentence compelling and hook the reader immediately
- End with a strong call-to-action or memorable conclusion

Generate the content now:`;

    let content = '';
    let method = 'ai';

    try {
      // Use z-ai-web-dev-sdk for real AI generation
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const maxTokens = contentType === 'meta' ? 100 : contentType === 'social' ? 300 : 2000;

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8, // Higher temperature for more creative/unique content
        max_tokens: maxTokens
      });

      content = completion.choices?.[0]?.message?.content || '';
      
      if (!content || content.length < 20) {
        throw new Error('AI returned insufficient content');
      }
      
    } catch (aiError: any) {
      console.error('AI generation error:', aiError?.message || aiError);
      
      // Enhanced fallback that creates unique content based on the topic
      content = generateEnhancedFallback(topic, contentType, contentTone);
      method = 'template';
    }
    
    return NextResponse.json({ 
      success: true, 
      content,
      type: contentType,
      topic,
      generatedAt: new Date().toISOString(),
      method,
      wordCount: content.split(/\s+/).length
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

// Enhanced fallback that generates more unique content based on topic
function generateEnhancedFallback(topic: string, type: string, tone: string): string {
  // Create topic-specific variations
  const topicLower = topic.toLowerCase();
  const topicWords = topic.split(' ');
  const mainKeyword = topicWords[0];
  
  // Generate unique angles based on topic keywords
  const angles = [
    `innovative approaches to ${topic}`,
    `${topic} strategies that actually work`,
    `the complete guide to mastering ${topic}`,
    `how ${topic} is transforming businesses`,
    `${topic}: proven tactics for success`
  ];
  
  const selectedAngle = angles[Math.floor(Math.random() * angles.length)];
  
  const templates: Record<string, string> = {
    blog: `# ${topic}: A Comprehensive Guide

${getToneOpen(tone, topic)}

In this in-depth guide, we'll explore everything you need to know about ${topic} — from foundational concepts to advanced strategies that can transform your results.

## Why ${topic} Matters Now More Than Ever

The landscape of ${topic} has evolved dramatically. What worked just a few years ago may no longer deliver the same results. Understanding the current best practices and emerging trends in ${topic} is essential for anyone looking to stay competitive.

### Current State of ${topic}

Recent studies show that organizations implementing effective ${topic} strategies see an average improvement of 35-50% in their key performance metrics. The gap between leaders and laggards in this space continues to widen.

## Key Components of Successful ${topic}

### 1. Foundation and Strategy

Before diving into ${topic} tactics, you need a solid foundation. This means:

- **Clear Objectives**: Define what success looks like for your ${topic} efforts
- **Audience Understanding**: Know who you're targeting and what they need
- **Resource Allocation**: Ensure you have the right tools and team in place

### 2. Implementation Best Practices

When implementing your ${topic} strategy, focus on these critical elements:

${getBestPractices(topic)}

### 3. Measurement and Optimization

Track these essential metrics for ${topic}:

- Engagement rates and quality signals
- Conversion metrics tied to your goals
- Long-term value indicators
- Competitive benchmarking

## Common ${topic} Mistakes to Avoid

${getMistakes(topic, tone)}

## Advanced ${topic} Techniques

For those ready to take their ${topic} efforts further:

1. **Data-Driven Decision Making**: Use analytics to guide every decision
2. **Continuous Testing**: Always be experimenting with new approaches
3. **Integration**: Connect ${topic} with your broader strategy
4. **Automation**: Leverage tools to scale your efforts efficiently

## Getting Started with ${topic}

Ready to improve your ${topic} approach? Here's your action plan:

1. Audit your current ${topic} efforts
2. Identify your biggest opportunities
3. Create a prioritized roadmap
4. Implement with focus and consistency
5. Measure, learn, and iterate

## Conclusion

${topic} represents a significant opportunity for those willing to invest the time and effort to do it right. By following the strategies outlined in this guide and staying committed to continuous improvement, you'll be well-positioned to achieve lasting success.

---

*This article provides a comprehensive overview of ${topic}. For personalized guidance, consider consulting with experts in this field.*`,

    product: `# ${topic}

${getToneOpen(tone, topic)}

## Overview

${topic} delivers exceptional value for organizations and individuals seeking proven results. Our approach combines cutting-edge methodology with practical implementation to ensure you achieve your goals.

## Key Features

${getProductFeatures(topic)}

## Benefits You'll Experience

- **Measurable Results**: Track your progress with clear metrics
- **Time Efficiency**: Achieve more in less time with optimized processes  
- **Scalability**: Solutions that grow with your needs
- **Expert Support**: Access to guidance when you need it

## Why Choose This ${topic} Solution?

Unlike generic alternatives, our ${topic} approach is:

- **Proven**: Tested across multiple scenarios and use cases
- **Customizable**: Adapted to your specific requirements
- **Sustainable**: Built for long-term success
- **Supported**: Backed by expertise and resources

## What Others Are Saying

${getTestimonials(topic, tone)}

## Get Started Today

Transform your approach to ${topic}. Contact us to learn how we can help you achieve your goals faster and more effectively.

**Ready to take the next step? Let's connect.**`,

    landing: `# Transform Your Results with ${topic}

${getToneOpen(tone, topic)}

## The ${topic} Advantage

Stop struggling with outdated approaches. Our ${topic} solution delivers the results you've been looking for.

### What We Deliver

✅ **Strategic Clarity** — Know exactly what to do and why  
✅ **Proven Framework** — Follow a path that works  
✅ **Expert Guidance** — Support when you need it  
✅ **Measurable Impact** — See real results

## How It Works

### Step 1: Discovery
We analyze your current ${topic} situation and identify opportunities for improvement.

### Step 2: Strategy  
We create a customized ${topic} plan tailored to your specific goals and resources.

### Step 3: Implementation
We guide you through execution with clear instructions and support.

### Step 4: Results
You see measurable improvements in your ${topic} outcomes.

## Why Choose Us

| Feature | What You Get |
|---------|--------------|
| Experience | 10+ years in ${topic} |
| Results | 500+ successful implementations |
| Support | 24/7 access to experts |
| Guarantee | Your satisfaction matters |

## What Our Clients Say

${getTestimonials(topic, tone)}

## Ready to Improve Your ${topic} Results?

Join hundreds of organizations who have transformed their approach to ${topic} with our help.

**[Get Started Now] [Schedule a Call] [Learn More]**`,

    meta: `${topic} - Expert guide with proven strategies and actionable tips. Discover how to improve your results with our comprehensive approach. Start today.`,

    social: `🚀 ${topic} - The Complete Guide!

Want to master ${topic}? Here's what you need to know:

✅ Proven strategies that work
✅ Step-by-step implementation
✅ Real results you can measure
✅ Expert tips and insights

Ready to level up your ${topic} game?

👇 Link in bio to learn more!

#${mainKeyword.replace(/[^a-zA-Z0-9]/g, '')} #Strategy #Growth #Tips #Success`
  };

  return templates[type] || templates.blog;
}

function getToneOpen(tone: string, topic: string): string {
  const opens: Record<string, string[]> = {
    professional: [
      `In the evolving landscape of ${topic}, understanding the core principles has become essential for success.`,
      `Organizations worldwide are recognizing the strategic importance of ${topic} in achieving their objectives.`,
      `As ${topic} continues to gain prominence, professionals are seeking comprehensive guidance on best practices.`
    ],
    casual: [
      `Let's talk about ${topic} — because honestly, it's more important than most people realize.`,
      `So you want to understand ${topic}? Great choice. Let me break it down for you.`,
      `Here's the thing about ${topic}: once you get it, everything changes for the better.`
    ],
    technical: [
      `The technical implementation of ${topic} requires a systematic approach across multiple domains.`,
      `From an architectural perspective, ${topic} encompasses several interconnected components that demand careful consideration.`,
      `Analyzing ${topic} through a technical lens reveals patterns and methodologies critical for optimal outcomes.`
    ],
    friendly: [
      `I'm excited to share everything I've learned about ${topic} with you!`,
      `If you've been curious about ${topic}, you're in exactly the right place.`,
      `Let's explore ${topic} together — I promise to make it clear and practical.`
    ]
  };
  
  const options = opens[tone] || opens.professional;
  return options[Math.floor(Math.random() * options.length)];
}

function getBestPractices(topic: string): string {
  const practices = [
    `- Start with clear goals and metrics for ${topic} success`,
    `- Document your processes for consistent ${topic} execution`,
    `- Review and update your ${topic} strategy quarterly`,
    `- Invest in training for anyone involved in ${topic}`,
    `- Use data to inform all ${topic} decisions`
  ];
  
  return practices.slice(0, 4).join('\n');
}

function getMistakes(topic: string, tone: string): string {
  if (tone === 'casual') {
    return `Watch out for these common ${topic} pitfalls:
    
- Trying to do too much at once (start small!)
- Ignoring the data because you "know better"
- Copying what others do without understanding why
- Giving up too early before seeing results`;
  }
  
  return `Even experienced practitioners make these ${topic} errors:

1. **Lack of Clear Strategy**: Jumping into tactics without defined objectives
2. **Inconsistent Execution**: Failing to maintain momentum and consistency
3. **Ignoring Analytics**: Making decisions based on assumptions rather than data
4. **Short-term Thinking**: Focusing on quick wins at the expense of sustainable growth`;
}

function getProductFeatures(topic: string): string {
  return `- **Comprehensive ${topic} Framework** — Everything you need in one place
- **Step-by-Step Implementation** — Clear guidance at every stage
- **Templates and Resources** — Save time with ready-to-use materials
- **Progress Tracking** — Monitor your ${topic} improvements
- **Expert Insights** — Learn from proven approaches`;
}

function getTestimonials(topic: string, tone: string): string {
  if (tone === 'casual') {
    return `"This ${topic} approach literally changed everything for us." — Happy Customer

"I was skeptical at first, but the results speak for themselves." — Satisfied User`;
  }
  
  return `"The ${topic} framework provided exactly what we needed to move forward with confidence." — Industry Leader

"Implementing these ${topic} strategies resulted in measurable improvements within 30 days." — Business Owner`;
}

export async function GET() {
  return NextResponse.json({ 
    message: "TrafficFlow AI Content Generator API",
    version: "3.0",
    status: "active",
    endpoints: {
      POST: "/api/generate-content - Generate unique AI content"
    },
    contentTypes: ['blog', 'product', 'landing', 'meta', 'social'],
    tones: ['professional', 'casual', 'technical', 'friendly']
  });
}
