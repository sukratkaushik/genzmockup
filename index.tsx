
// FIX: Add a triple-slash directive to include the DOM library. This resolves numerous TypeScript errors
// related to missing types for 'document', 'window', HTML elements, and other browser-specific APIs.
/// <reference lib="dom" />

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Modality, GenerateContentResponse, Type } from '@google/genai';
import JSZip from 'jszip';

// ========================================
// GEN-Z DATA CONSTANTS
// ========================================

const GENZ_POSES = [
  "Standing straight (neutral)",
  "Casual lean against wall",
  "Sitting on ledge/stairs/curb",
  "Walking/mid-stride",
  "Hands in pockets (relaxed)",
  "Arms crossed (confident)",
  "One hand in pocket, other adjusting sunglasses",
  "Crouching/squatting (urban squat)",
  "Leaning forward (hands on knees)",
  "Looking over shoulder"
];

const GENZ_ACTIONS = [
  "Empty hands (no prop)",
  "Holding iced coffee/energy drink",
  "Holding phone (scrolling/taking selfie)",
  "Adjusting baseball cap/beanie",
  "Holding skateboard under arm",
  "Hands gesturing (peace sign/thumbs up)",
  "Adjusting headphones/earbuds",
  "Holding disposable camera",
  "Holding spray paint can",
  "Fiddling with chain necklace"
];

const GENZ_EXPRESSIONS = [
  "Indifferent/unbothered (default)",
  "Smirking/subtle smile",
  "Serious/stoic",
  "Laughing/candid laugh",
  "Looking away (mysterious)",
  "Mid-conversation (talking)",
  "Yawning/tired",
  "Surprised/caught off-guard"
];

const GENZ_LOCATIONS = [
  "Parking Lot at Night (Dim lighting, concrete)",
  "Urban Alleyway (Brick walls, graffiti, dumpster)",
  "Skate Park (Concrete ramps, harsh lights)",
  "Rooftop at Dusk (City skyline, golden hour)",
  "Subway Station Platform (Tile walls, fluorescent)",
  "Corner Store Exterior (Neon signs, bodega)",
  "Basketball Court (Chain-link fence, asphalt)",
  "Abandoned Warehouse (Industrial, moody shadows)",
  "Gas Station (Fluorescent canopy, pumps)",
  "Under Highway Overpass (Concrete pillars, grit)"
];

const GENZ_LIGHTING = [
  "Default Flash (Harsh, direct, high contrast)",
  "Double Flash (Extra bright, blown-out)",
  "Colored Gel Flash (Blue/Red/Purple tint)",
  "Natural Streetlight (Softer, yellow-toned)",
  "Neon Accent (Neon signs adding color)"
];

const GENZ_ACCESSORIES = [
  { id: "Sunglasses (on face)", label: "Sunglasses" },
  { id: "Baseball cap (forward)", label: "Cap" },
  { id: "Beanie", label: "Beanie" },
  { id: "Chain necklace", label: "Chain" },
  { id: "Wired headphones", label: "Headphones" },
  { id: "Wireless earbuds", label: "Earbuds" },
  { id: "Backpack (one strap)", label: "Backpack" },
  { id: "Tote bag", label: "Tote Bag" }
];

// ========================================
// COLLAGE GENERATION UTILITY
// ========================================

interface CollageConfig {
  images: HTMLImageElement[];
  imageDataUrls: string[];
  imageCount: number;
  outputWidth: number;
  outputHeight: number;
}

interface CollageLayout {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  gapSize: number;
}

/**
 * Calculate optimal collage layout based on image count
 * Always returns 3:4 ratio compatible layout
 */
function calculateCollageLayout(imageCount: number): CollageLayout {
  // Define layout options (rows, cols, gap)
  const layouts: Record<number, { rows: number; cols: number; gap: number }> = {
    1: { rows: 1, cols: 1, gap: 0 },
    2: { rows: 2, cols: 1, gap: 12 },
    3: { rows: 3, cols: 1, gap: 12 },
    4: { rows: 2, cols: 2, gap: 12 },
    5: { rows: 3, cols: 2, gap: 12 }, // 2 rows of 2, 1 row of 1
    6: { rows: 3, cols: 2, gap: 12 },
    7: { rows: 3, cols: 3, gap: 8 },  // 3x3 grid (1 cell empty)
    8: { rows: 3, cols: 3, gap: 8 },  // 3x3 grid (1 cell empty)
    9: { rows: 3, cols: 3, gap: 8 },
  };

  const layout = layouts[Math.min(imageCount, 9)];

  // Output dimensions - 3:4 ratio
  const OUTPUT_WIDTH = 720;
  const OUTPUT_HEIGHT = 960;

  // Calculate cell dimensions
  const totalGapWidth = (layout.cols - 1) * layout.gap;
  const totalGapHeight = (layout.rows - 1) * layout.gap;

  const cellWidth = (OUTPUT_WIDTH - totalGapWidth) / layout.cols;
  const cellHeight = (OUTPUT_HEIGHT - totalGapHeight) / layout.rows;

  return {
    rows: layout.rows,
    cols: layout.cols,
    cellWidth: Math.floor(cellWidth),
    cellHeight: Math.floor(cellHeight),
    gapSize: layout.gap,
  };
}

/**
 * Load image from data URL into HTMLImageElement
 */
function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from data URL`));
    
    img.src = dataUrl;
  });
}

/**
 * Draw image on canvas maintaining aspect ratio (cover mode)
 */
function drawImageOnCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  // Calculate aspect ratios
  const imgRatio = img.width / img.height;
  const cellRatio = width / height;

  let srcX = 0;
  let srcY = 0;
  let srcWidth = img.width;
  let srcHeight = img.height;

  // Cover mode: fill the entire cell
  if (imgRatio > cellRatio) {
    // Image is wider, crop sides
    srcWidth = img.height * cellRatio;
    srcX = (img.width - srcWidth) / 2;
  } else {
    // Image is taller, crop top/bottom
    srcHeight = img.width / cellRatio;
    srcY = (img.height - srcHeight) / 2;
  }

  // Draw on canvas
  ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, x, y, width, height);
}

/**
 * Generate collage from selected images
 */
async function generateCollage(imageDataUrls: string[]): Promise<string> {
  try {
    if (imageDataUrls.length === 0) {
      throw new Error('No images selected for collage');
    }

    if (imageDataUrls.length > 9) {
      throw new Error('Maximum 9 images allowed for collage');
    }

    console.log(`🎨 Starting collage generation with ${imageDataUrls.length} images`);

    // Calculate layout
    const layout = calculateCollageLayout(imageDataUrls.length);
    console.log(`📐 Layout: ${layout.rows}x${layout.cols} grid, ${layout.cellWidth}x${layout.cellHeight}px cells`);

    // Create canvas
    const OUTPUT_WIDTH = 720;
    const OUTPUT_HEIGHT = 960;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_WIDTH;
    canvas.height = OUTPUT_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Fill background with white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    // Load all images
    const images: HTMLImageElement[] = [];
    for (let i = 0; i < imageDataUrls.length; i++) {
      try {
        const img = await loadImageFromDataUrl(imageDataUrls[i]);
        images.push(img);
        console.log(`✅ Loaded image ${i + 1}/${imageDataUrls.length}`);
      } catch (error) {
        console.warn(`⚠️ Failed to load image ${i + 1}, skipping`, error);
      }
    }

    if (images.length === 0) {
      throw new Error('Failed to load any images');
    }

    // Draw images on canvas
    let imageIndex = 0;
    let yOffset = 0;

    for (let row = 0; row < layout.rows; row++) {
      let xOffset = 0;

      for (let col = 0; col < layout.cols; col++) {
        if (imageIndex >= images.length) break;

        const x = xOffset;
        const y = yOffset;

        // Draw image
        drawImageOnCanvas(
          ctx,
          images[imageIndex],
          x,
          y,
          layout.cellWidth,
          layout.cellHeight
        );

        // Draw border between cells
        if (layout.gapSize > 0) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = layout.gapSize;
          ctx.strokeRect(x, y, layout.cellWidth, layout.cellHeight);
        }

        xOffset += layout.cellWidth + layout.gapSize;
        imageIndex++;
      }

      yOffset += layout.cellHeight + layout.gapSize;
    }

    // Convert to data URL
    const collageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    console.log(`✅ Collage generated successfully (${imageDataUrls.length} images)`);

    return collageDataUrl;

  } catch (error) {
    console.error('❌ Collage generation error:', error);
    throw error;
  }
}

// ========================================
// PROMPT TEMPLATE SYSTEM
// ========================================

interface PromptConfig {
  design: string;
  productType: string;
  color: string;
  style: {
    model: string;
    race: string;
    physique: string;
    pose: string;
    mood: string;
    display: string;
    aesthetic: string;
    season: string;
    generation: string;
  };
  // NEW: Gen-Z specific options
  genZ?: {
      location: string;
      lighting: string;
      bodyPose: string;
      handAction: string;
      expression: string;
      accessories: string[];
  };
  background: string;
  quality: 'standard' | 'high' | 'ultra';
}

interface QualitySettings {
  resolution: string;
  detailLevel: string;
  compressionQuality: string;
}

const QUALITY_PRESETS: Record<string, QualitySettings> = {
  standard: {
    resolution: '1024x1024',
    detailLevel: 'standard detail',
    compressionQuality: 'balanced',
  },
  high: {
    resolution: '1536x1536',
    detailLevel: 'high detail',
    compressionQuality: 'high quality',
  },
  ultra: {
    resolution: '2048x2048',
    detailLevel: 'ultra-high detail',
    compressionQuality: 'maximum quality',
  },
};

const VIBE_PROMPTS: Record<string, string> = {
  studio: "Clean professional studio environment with solid color backdrop, perfect evenly distributed lighting, commercial photography style, minimalist composition.",
  lifestyle: "Natural lifestyle setting, authentic everyday environment (like a coffee shop, park, or living room), blurred background depth of field, candid feel.",
  streetwear: "Gritty urban street setting, concrete textures, graffiti art in background, high contrast lighting, edgy fashion editorial look, raw asphalt and brick textures.",
  luxury: "High-end luxury retail environment, marble surfaces, gold accents, dramatic moody lighting, expensive atmosphere, vogue magazine editorial style.",
  industrial: "Raw industrial warehouse space, exposed brick walls, concrete floors, metal beams, large factory windows with natural light, modern rustic vibe.",
  boho: "Bohemian aesthetic with natural textures, dried flowers, rattan furniture, warm earth tones, soft sunlight, cozy organic atmosphere.",
  minimalist: "Ultra-minimalist architectural space, clean lines, white or concrete surfaces, sparse composition, zen-like atmosphere, soft diffuse light.",
  retro: "Vintage 90s or 80s aesthetic, film grain texture, warm nostalgic color grading, retro furniture props, flash photography style."
};

const SEASON_PROMPTS: Record<string, string> = {
  any: "Neutral seasonal lighting, balanced color temperature, suitable for year-round usage.",
  spring: "Fresh spring atmosphere, soft pastel lighting, blooming flowers in background, dewy textures, bright airy feel.",
  summer: "Bright summer sunlight, hard shadows, high contrast, warm golden hour tones, vibrant energetic atmosphere.",
  autumn: "Cozy autumn vibe, warm orange and brown tones, fallen leaves in background, soft golden afternoon light, rich textures.",
  winter: "Cold winter atmosphere, cool blue tones, soft diffused overcast lighting, perhaps hint of frost or snow, cozy knit textures."
};

const PHYSIQUE_PROMPTS: Record<string, string> = {
    any: "standard fit model physique",
    athletic: "athletic physique, defined muscles, broad shoulders, fit and toned body shape",
    super_model: "tall supermodel physique, slender and elegant frame, high fashion stature",
    slim: "very slim and slender physique, narrow frame, delicate features",
    gym_built: "heavily muscular bodybuilder physique, thick chest and arms, gym-honed build"
};

/**
 * Enhanced gender descriptors for better model realism
 */
function getEnhancedModelDescription(config: PromptConfig): string {
    const { model, race, physique, pose } = config.style;
    const physiquePrompt = PHYSIQUE_PROMPTS[physique] || PHYSIQUE_PROMPTS.any;
    
    const raceStr = race !== 'any' ? `${race} ethnicity` : 'diverse ethnicity';
    
    if (model === 'female' || model === 'plus_f') {
        const plusStr = model === 'plus_f' ? 'plus-size' : '';
        return `an extremely attractive and feminine ${raceStr} female model, ${plusStr} curvy silhouette, highly feminine facial features, sexy and confident aura, ${physiquePrompt}, ${pose} pose`;
    }
    
    if (model === 'male' || model === 'plus_m') {
        const plusStr = model === 'plus_m' ? 'plus-size' : '';
        return `a clearly masculine and handsome ${raceStr} male model, sharp facial features, strong jawline, athletic and manly build, ${plusStr} ${physiquePrompt}, ${pose} pose`;
    }
    
    if (model === 'couple') {
        return `a highly attractive couple consisting of a masculine handsome man and a feminine curvy woman, ${raceStr}, both looking incredible`;
    }
    
    if (model === 'family') {
        return `a family group (masculine father, feminine curvy mother, and children), all with ${raceStr}, wearing matching outfits`;
    }
    
    return `a cool and attractive Gen-Z model`;
}

const PROMPT_TEMPLATES = {
  gen_z_aesthetic: (config: PromptConfig): string => {
      const { productType, color } = config;
      // Get detailed options if available, or fall back to defaults
      const z = config.genZ || {
          location: "Parking Lot at Night (Dim lighting, concrete)",
          lighting: "Default Flash (Harsh, direct, high contrast)",
          bodyPose: "Casual lean against wall",
          handAction: "Holding iced coffee",
          expression: "Indifferent/unbothered",
          accessories: ["Sunglasses"]
      };

      const accessoriesList = z.accessories && z.accessories.length > 0 ? z.accessories.join(", ") : "No accessories";
      
      const gender = config.style.model === 'none' ? 'model' : config.style.model.replace('plus_m', 'plus-size male').replace('plus_f', 'plus-size female');
      const ethnicity = config.style.race !== 'any' ? config.style.race : 'diverse';
      const physique = config.style.physique !== 'any' ? config.style.physique : 'fit';

      // Specialized Gen-Z prompt structure based on spec
      return `CRITICAL COLOR INSTRUCTION: The garment MUST be ${color}. Do NOT change the fabric color.

CRITICAL DESIGN PLACEMENT: The user's design is printed on the center chest area. 
Direct-to-garment print style. NO background rectangle. Design should pop against 
the fabric with high ink density.

PRODUCT: ${color} oversized ${productType}
Fit: Baggy streetwear style, dropped shoulders, relaxed fit, oversized silhouette.

MODEL: Gen-Z 18-26 years old ${gender} with ${ethnicity} ethnicity, ${physique} physique.

POSE & ACTION:
- Body pose: ${z.bodyPose}
- Hand action: ${z.handAction}
- Accessories: ${accessoriesList}
- Expression: ${z.expression}

LOCATION: ${z.location}

LIGHTING: Flash photography style, ${z.lighting}.
Hard direct flash, high contrast, harsh shadows, vignette effect.

TECHNICAL SPECS:
- Camera: Disposable camera aesthetic
- Film: Grainy texture (ISO 800-1600)
- Mood: Candid, unposed, authentic Gen-Z energy
- Style: Raw street photography
- Aspect ratio: 3:4 portrait
- Focus: Sharp on the design print

REALISM:
- Highly realistic skin texture, subtle pores, natural imperfections
- NO plastic skin, NO over-smoothing
- Visible fabric texture in transparent areas of design
- The design ink must be DEEP BLACK (#000000), opaque, high contrast

Overall vibe: Urban, gritty, authentic Gen-Z aesthetic, disposable camera nostalgia.`;
  },
  millennial_aesthetic: (config: PromptConfig): string => {
      const { productType, color } = config;
      const quality = QUALITY_PRESETS[config.quality];
      const modelDesc = getEnhancedModelDescription(config);
      return `CRITICAL COLOR INSTRUCTION: The garment MUST be ${color}.
Polished Millennial lifestyle photography, ${quality.detailLevel}. 
SUBJECT: A relatable Millennial ${modelDesc} wearing a ${color} ${productType}. Clean, trendy, high-quality fabric.
DESIGN INTEGRATION: User design centered on chest. 
SETTING: Aesthetic minimalist coffee shop or light-filled modern apartment, plants in background.
LIGHTING: Soft natural morning light, bright and airy feel, warm color grading.
TECHNICAL SPECS: Shot on mirrorless camera, 35mm lens, f/1.8 for soft background bokeh. Clean composition, Instagram-ready look.`;
  },
  apparel_v2: (config: PromptConfig): string => {
    // Check if generation is selected
    if (config.style.generation === 'gen_z') return PROMPT_TEMPLATES.gen_z_aesthetic(config);
    if (config.style.generation === 'millennial') return PROMPT_TEMPLATES.millennial_aesthetic(config);

    const quality = QUALITY_PRESETS[config.quality];
    const vibePrompt = VIBE_PROMPTS[config.style.aesthetic] || VIBE_PROMPTS.studio;
    const seasonPrompt = SEASON_PROMPTS[config.style.season] || SEASON_PROMPTS.any;
    
    const modelDesc = getEnhancedModelDescription(config);

    return `CRITICAL COLOR INSTRUCTION: The shirt MUST be ${config.color}. Do NOT change the shirt color.

Photorealistic lifestyle photography, ${quality.detailLevel}.

PRODUCT: ${config.color} ${config.productType}
DESIGN: ${config.design}, centered chest placement, properly scaled.
MODEL: ${modelDesc}. Ensure genders are clearly distinguishable: females must look very feminine and attractive with curvy builds, males must look masculine and handsome.

CRITICAL INK DENSITY:
- The black ink in the design must be DEEP, OPAQUE, and RICH BLACK (#000000).
- High contrast between the ink and the fabric.
- NO washed-out or faded greyish blacks.

CRITICAL TRANSPARENCY INSTRUCTION:
- The design is a DIRECT-TO-GARMENT print.
- There is NO background rectangle behind the design.
- The fabric texture should be visible ONLY in the transparent areas of the design.
- Do NOT render a black, white, or colored box around the artwork.
- The artwork should look like it is screen-printed directly onto the fabric.

REALISM:
- Highly realistic skin texture, subtle pores, peach fuzz, faint freckles, and flyaway hairs.
- NO plastic skin. NO over-smoothing.
- Raw photography style, slight natural imperfections.

SETTING: ${vibePrompt}, ${seasonPrompt}
BACKGROUND: ${config.background}

TECHNICAL SPECS:
- Camera: 85mm portrait lens, f/2.8
- Lighting: Natural ${config.style.season} light
- Focus: Sharp on design
- Resolution: ${quality.resolution}`;
  },
  product_v2: (config: PromptConfig): string => {
      const quality = QUALITY_PRESETS[config.quality];
      const vibePrompt = VIBE_PROMPTS[config.style.aesthetic] || VIBE_PROMPTS.studio;
      const seasonPrompt = SEASON_PROMPTS[config.style.season] || SEASON_PROMPTS.any;

      return `CRITICAL COLOR INSTRUCTION: The product MUST be ${config.color}.

Professional product photography, ${quality.detailLevel}.

PRODUCT: ${config.color} ${config.productType}
DESIGN: ${config.design}, centered placement.

CRITICAL INK DENSITY:
- The black ink in the design must be DEEP, OPAQUE, and RICH BLACK.
- High contrast. NO washed-out blacks.

CRITICAL TRANSPARENCY INSTRUCTION:
- Direct-to-garment print style.
- NO background rectangle or bounding box behind the artwork.
- Transparent areas must show the product fabric.

SETTING: ${vibePrompt} ${config.style.display} environment
BACKGROUND: ${config.background}
CONTEXT: ${seasonPrompt}

TECHNICAL SPECS:
- Camera: 50mm macro lens, f/4 aperture
- Lighting: Three-point lighting setup
- Texture: High fidelity material textures
- Resolution: ${quality.resolution}`;
  },
  tote_bag_v2: (config: PromptConfig): string => {
      const quality = QUALITY_PRESETS[config.quality];
      const vibePrompt = VIBE_PROMPTS[config.style.aesthetic] || VIBE_PROMPTS.studio;
      const seasonPrompt = SEASON_PROMPTS[config.style.season] || SEASON_PROMPTS.any;
      const modelDesc = getEnhancedModelDescription(config);

      return `CRITICAL COLOR INSTRUCTION: The bag MUST be ${config.color}.

Professional lifestyle photography of a tote bag, ${quality.detailLevel}.

PRODUCT: ${config.color} tote bag
DESIGN: ${config.design}, centered on front panel.
MODEL: ${modelDesc}, holding the bag naturally.

CRITICAL INK DENSITY:
- The black ink must be DEEP, OPAQUE, and RICH BLACK.
- High contrast.

CRITICAL TRANSPARENCY INSTRUCTION:
- Screen printed look.
- NO background rectangle behind the design.
- Canvas texture should show through transparent areas.

REALISM:
- Authentic skin texture on hands/arms, visible veins/pores.
- Not overly smooth.

SETTING: ${vibePrompt}, ${seasonPrompt}
BACKGROUND: ${config.background}

TECHNICAL SPECS:
- Camera: 50mm lens, f/2.8
- Lighting: Natural ${config.style.season} lighting
- Resolution: ${quality.resolution}`;
  },
  flat_lay_v2: (config: PromptConfig): string => {
      const quality = QUALITY_PRESETS[config.quality];
      return `Flat lay product photography, ${quality.detailLevel}.

PRODUCT: ${config.color} ${config.productType} laid flat
DESIGN: ${config.design}, centered, clearly visible
SURFACE: ${config.style.aesthetic} surface (wood/marble/fabric)
PROPS: Minimal lifestyle props (${config.style.season} theme)
LIGHTING: Soft overhead ${config.style.season} lighting

TECHNICAL SPECS:
- Camera: Directly overhead (90° angle)
- Lighting: Diffused natural light, minimal shadows, organic texture
- Styling: Clean, organized, professional but lived-in feel
- Resolution: ${quality.resolution}, ${quality.compressionQuality}`;
  },
};

function getPromptTemplate(config: PromptConfig): (config: PromptConfig) => string {
    const { productType, style } = config;
    const lowerProduct = productType.toLowerCase();
    const lowerDisplay = style.display.toLowerCase();
    const hasModel = style.model !== 'none';

    if (lowerDisplay.includes('flat') || lowerDisplay.includes('lay')) {
        return PROMPT_TEMPLATES.flat_lay_v2;
    }
    if (['hanging', 'folded', 'ghost-mannequin'].includes(lowerDisplay)) {
        return PROMPT_TEMPLATES.product_v2;
    }
    
    if (hasModel) {
        if (lowerProduct.includes('tote') || lowerProduct.includes('bag')) {
            return PROMPT_TEMPLATES.tote_bag_v2;
        }
        if (
            lowerProduct.includes('shirt') ||
            lowerProduct.includes('hoodie') ||
            lowerProduct.includes('sweatshirt') ||
            lowerProduct.includes('gildan') ||
            lowerProduct.includes('sweater') ||
            lowerProduct.includes('tee')
        ) {
            return PROMPT_TEMPLATES.apparel_v2;
        }
        return PROMPT_TEMPLATES.apparel_v2;
    }
    return PROMPT_TEMPLATES.product_v2;
}

function buildOptimizedPrompt(config: PromptConfig): string {
  const template = getPromptTemplate(config);
  return template(config);
}

// ========================================
// COST TRACKING SYSTEM (Modified for new UI)
// ========================================

interface CostMetrics {
  totalGenerations: number;
  successfulGenerations: number;
  estimatedCost: number;
  totalTimeMs: number;
  lastGenerationDate: string;
  todayGenerations: number;
  todayFailures: number;
  todayTotalTimeMs: number;
  todayEstimatedCost: number;
}

// Updated costs to match Dashboard display ($0.05)
const API_COSTS: Record<string, number> = {
  'standard': 0.0500,
  'high': 0.0500,
  'ultra': 0.0500,
};

const getInitialMetrics = (): CostMetrics => ({
  totalGenerations: 0,
  successfulGenerations: 0,
  estimatedCost: 0,
  totalTimeMs: 0,
  lastGenerationDate: new Date().toISOString().split('T')[0],
  todayGenerations: 0,
  todayFailures: 0,
  todayTotalTimeMs: 0,
  todayEstimatedCost: 0,
});

let currentMetrics: CostMetrics = getInitialMetrics();

function loadCostMetrics(): void {
  const savedCurrent = localStorage.getItem('mockupGenerator_currentMetrics');
  if (savedCurrent) {
    try {
      currentMetrics = JSON.parse(savedCurrent);
      const todayStr = new Date().toISOString().split('T')[0];
      if (currentMetrics.lastGenerationDate !== todayStr) {
        currentMetrics.lastGenerationDate = todayStr;
        currentMetrics.todayGenerations = 0;
        currentMetrics.todayFailures = 0;
        currentMetrics.todayTotalTimeMs = 0;
        currentMetrics.todayEstimatedCost = 0;
      }
    } catch (e) { console.warn('Failed to load metrics'); }
  }
}

function saveCostMetrics(): void {
  localStorage.setItem('mockupGenerator_currentMetrics', JSON.stringify(currentMetrics));
}

function trackGeneration(quality: string, success: boolean, timeMs: number): void {
  const todayStr = new Date().toISOString().split('T')[0];
  if (currentMetrics.lastGenerationDate !== todayStr) {
    currentMetrics.lastGenerationDate = todayStr;
    currentMetrics.todayGenerations = 0;
    currentMetrics.todayFailures = 0;
    currentMetrics.todayTotalTimeMs += timeMs; // Fixed logic bug
    currentMetrics.todayEstimatedCost = 0;
  }
  
  const cost = API_COSTS[quality] || 0.05;
  
  currentMetrics.totalGenerations++;
  currentMetrics.totalTimeMs += timeMs;
  currentMetrics.todayGenerations++;
  currentMetrics.todayTotalTimeMs += timeMs;

  if (success) {
    currentMetrics.successfulGenerations++;
    currentMetrics.estimatedCost += cost;
    currentMetrics.todayEstimatedCost += cost;
  } else {
    currentMetrics.todayFailures++;
  }

  saveCostMetrics();
  updateCostDisplay();
}

function updateCostDisplay(): void {
  const getEl = (id: string) => document.getElementById(id);
  
  // Lifetime
  const totalMockupsEl = getEl('stat-total-mockups');
  if(totalMockupsEl) totalMockupsEl.textContent = currentMetrics.successfulGenerations.toString();
  
  const totalCostEl = getEl('stat-total-cost');
  if(totalCostEl) totalCostEl.textContent = `$${currentMetrics.estimatedCost.toFixed(4)}`;

  // Daily
  const todayGenEl = getEl('dash-total-gen');
  if (todayGenEl) todayGenEl.textContent = currentMetrics.todayGenerations.toString();
  
  const todayCostEl = getEl('dash-cost');
  if (todayCostEl) todayCostEl.textContent = `$${currentMetrics.todayEstimatedCost.toFixed(4)}`;
  
  const statusEl = getEl('dash-status-counts');
  if(statusEl) {
      const success = currentMetrics.todayGenerations - currentMetrics.todayFailures;
      statusEl.textContent = `${success} Success / ${currentMetrics.todayFailures} Failed`;
  }
}

function setupStatsReset() {
    const resetLifetimeBtn = document.getElementById('reset-lifetime-btn');
    const resetTodayBtn = document.getElementById('reset-today-btn');

    // Using onclick property to ensure single listener and prevent bubbling issues
    if(resetLifetimeBtn) {
        resetLifetimeBtn.onclick = (e) => {
            e.preventDefault();
            if(confirm('Are you sure you want to reset ALL lifetime stats? This cannot be undone.')) {
                currentMetrics = getInitialMetrics();
                saveCostMetrics();
                updateCostDisplay();
            }
        };
    }

    if(resetTodayBtn) {
        resetTodayBtn.onclick = (e) => {
            e.preventDefault();
            const todayStr = new Date().toISOString().split('T')[0];
            // Reset only today's values
            currentMetrics.lastGenerationDate = todayStr;
            currentMetrics.todayGenerations = 0;
            currentMetrics.todayFailures = 0;
            currentMetrics.todayTotalTimeMs = 0;
            currentMetrics.todayEstimatedCost = 0;
            saveCostMetrics();
            updateCostDisplay();
        };
    }
}

// ========================================
// UI/UX IMPROVEMENT SYSTEM (ACCORDION, CARDS, etc.)
// ========================================

// ... (Product Options & Colors - Same as before) ...
interface ProductOption { id: string; name: string; icon: string; }

const PRODUCT_OPTIONS: ProductOption[] = [
  { id: 't-shirt', name: 'Gildan 5000', icon: '👕' },
  { id: 'oversized-tee', name: 'Oversized Tee', icon: '👕' },
  { id: 'hoodie', name: 'Gildan 18500', icon: '🧥' },
  { id: 'sweatshirt', name: 'Gildan 18000', icon: '👔' },
  { id: 'mug', name: 'Mug', icon: '☕' },
  { id: 'phone-case', name: 'Phone Case', icon: '📱' },
  { id: 'tote-bag', name: 'Tote Bag', icon: '👜' },
  { id: 'notebook', name: 'Notebook', icon: '📓' },
  { id: 'pillow', name: 'Pillow', icon: '🛏️' },
];

interface ColorOption { id: string; name: string; hex: string; }

const DEFAULT_COLOR_OPTIONS: ColorOption[] = [
  { id: 'black', name: 'Black', hex: '#000000' },
  { id: 'white', name: 'White', hex: '#FFFFFF' },
  { id: 'red', name: 'Red', hex: '#EF4444' },
  { id: 'blue', name: 'Blue', hex: '#3B82F6' },
  { id: 'navy', name: 'Navy', hex: '#1E3A8A' },
  { id: 'green', name: 'Green', hex: '#10B981' },
  { id: 'gray', name: 'Gray', hex: '#6B7280' },
  { id: 'pink', name: 'Pink', hex: '#EC4899' },
];

// --- GILDAN 5000 COLORS ---
const GILDAN_5000_COLORS: ColorOption[] = [
  { id: 'white', name: 'White', hex: '#FFFFFF' },
  { id: 'black', name: 'Black', hex: '#111111' },
  { id: 'sport_grey', name: 'Sport Grey', hex: '#9B9B9B' },
  { id: 'navy', name: 'Navy', hex: '#1C2438' },
  { id: 'royal', name: 'Royal', hex: '#1A4593' },
  { id: 'red', name: 'Red', hex: '#C71F2D' },
  { id: 'forest_green', name: 'Forest Green', hex: '#1F3628' },
  { id: 'maroon', name: 'Maroon', hex: '#541E28' },
  { id: 'sand', name: 'Sand', hex: '#D0C3B2' },
  { id: 'charcoal', name: 'Charcoal', hex: '#454545' },
  { id: 'dark_heather', name: 'Dark Heather', hex: '#383838' },
  { id: 'light_blue', name: 'Light Blue', hex: '#A6C6D6' },
  { id: 'light_pink', name: 'Light Pink', hex: '#F8C5D1' },
  { id: 'military_green', name: 'Military Green', hex: '#4A523C' },
  { id: 'orange', name: 'Orange', hex: '#F05E23' },
  { id: 'purple', name: 'Purple', hex: '#3F2A56' },
  { id: 'gold', name: 'Gold', hex: '#FFB81C' },
  { id: 'daisy', name: 'Daisy', hex: '#FED600' },
];

// --- GILDAN 18500 COLORS (HOODIE) ---
const GILDAN_18500_COLORS: ColorOption[] = [
  { id: 'white', name: 'White', hex: '#FFFFFF' },
  { id: 'black', name: 'Black', hex: '#111111' },
  { id: 'sport_grey', name: 'Sport Grey', hex: '#9B9B9B' },
  { id: 'navy', name: 'Navy', hex: '#1C2438' },
  { id: 'royal', name: 'Royal', hex: '#1A4593' },
  { id: 'red', name: 'Red', hex: '#C71F2D' },
  { id: 'forest_green', name: 'Forest Green', hex: '#1F3628' },
  { id: 'maroon', name: 'Maroon', hex: '#541E28' },
  { id: 'dark_heather', name: 'Dark Heather', hex: '#383838' },
  { id: 'sand', name: 'Sand', hex: '#D0C3B2' },
  { id: 'light_pink', name: 'Light Pink', hex: '#F8C5D1' },
  { id: 'military_green', name: 'Military Green', hex: '#4A523C' },
  { id: 'indigo_blue', name: 'Indigo Blue', hex: '#3F4C5E' },
  { id: 'irish_green', name: 'Irish Green', hex: '#009E60' },
  { id: 'dark_chocolate', name: 'Dark Chocolate', hex: '#362925' },
];

// --- GILDAN 18000 COLORS (SWEATSHIRT) ---
const GILDAN_18000_COLORS: ColorOption[] = [
  { id: 'white', name: 'White', hex: '#FFFFFF' },
  { id: 'black', name: 'Black', hex: '#111111' },
  { id: 'sport_grey', name: 'Sport Grey', hex: '#9B9B9B' },
  { id: 'navy', name: 'Navy', hex: '#1C2438' },
  { id: 'royal', name: 'Royal', hex: '#1A4593' },
  { id: 'red', name: 'Red', hex: '#C71F2D' },
  { id: 'forest_green', name: 'Forest Green', hex: '#1F3628' },
  { id: 'maroon', name: 'Maroon', hex: '#541E28' },
  { id: 'dark_heather', name: 'Dark Heather', hex: '#383838' },
  { id: 'sand', name: 'Sand', hex: '#D0C3B2' },
  { id: 'light_pink', name: 'Light Pink', hex: '#F8C5D1' },
  { id: 'military_green', name: 'Military Green', hex: '#4A523C' },
  { id: 'ash', name: 'Ash', hex: '#D8D8D8' },
  { id: 'orange', name: 'Orange', hex: '#F05E23' },
  { id: 'purple', name: 'Purple', hex: '#3F2A56' },
];

function initAccordions(): void {
  const accordionHeaders = document.querySelectorAll('.accordion-header');
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const isActive = header.classList.contains('active');
      const accordionId = header.getAttribute('data-accordion');
      const content = document.getElementById(`accordion-${accordionId}`);
      if (!content) return;
      if (isActive) {
        header.classList.remove('active');
        content.classList.remove('active');
      } else {
        header.classList.add('active');
        content.classList.add('active');
      }
    });
  });
}

function generateProductCards(): void {
  const productGrid = document.querySelector('.product-grid');
  if (!productGrid) return;
  productGrid.innerHTML = '';
  
  PRODUCT_OPTIONS.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.productId = product.id;
    
    card.innerHTML = `
      <span class="product-card-icon">${product.icon}</span>
      <div class="product-card-name">${product.name}</div>
      <div class="product-card-badge">✓</div>
      <button class="create-variants-btn">🎨 Colors</button>
    `;
    
    card.addEventListener('click', () => {
      card.classList.toggle('selected');
      updateSelectedProducts();
      saveState();
    });

    const variantsBtn = card.querySelector('.create-variants-btn') as HTMLButtonElement;
    variantsBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openColorModal(product.id, product.name);
    });
    productGrid.appendChild(card);
  });
}

// Track active product for coloring
let activeProductIdForColor: string | null = null;

function openColorModal(pid: string, pname: string) {
    activeProductIdForColor = pid; // Set Active Context
    
    let colors = DEFAULT_COLOR_OPTIONS; 
    if (pid === 't-shirt' || pid === 'oversized-tee') colors = GILDAN_5000_COLORS;
    else if (pid === 'hoodie') colors = GILDAN_18500_COLORS;
    else if (pid === 'sweatshirt') colors = GILDAN_18000_COLORS;
    
    colorModalTitle.textContent = `${pname} Colors`;
    colorPickerGrid.innerHTML = '';
    
    // Get colors for THIS product specifically
    const currentColors = productColors.get(pid) || new Set<string>();
    
    colors.forEach(c => {
        const item = document.createElement('div');
        const isSelected = currentColors.has(c.id);
        item.className = `color-picker-item ${isSelected ? 'selected' : ''}`;
        item.innerHTML = `<div class="color-picker-swatch" style="background-color:${c.hex}"></div><div class="color-picker-name">${c.name}</div>`;
        
        item.onclick = () => {
            toggleColor(pid, c.id);
            item.classList.toggle('selected');
        }
        colorPickerGrid.appendChild(item);
    });
    colorModal.classList.remove('hidden');
}

function toggleColor(productId: string, colorId: string) {
    let colors = productColors.get(productId) || new Set<string>();
    if (colors.has(colorId)) {
       // if (colors.size > 1) colors.delete(colorId); // Allow deselecting all? Let's allow it, but validate on generate
        colors.delete(colorId);
    } else {
        colors.add(colorId);
    }
    productColors.set(productId, colors);
    saveState();
    updateGenerateButtonState(); // Update cost logic
}


function updateSelectedProducts(): void {
  const selectedCards = document.querySelectorAll('.product-card.selected');
  selectedProductIds.clear();
  selectedCards.forEach(card => {
      const pid = card.getAttribute('data-product-id');
      if(pid) {
          selectedProductIds.add(pid);
          // Initialize colors if empty
          if(!productColors.has(pid) || productColors.get(pid)!.size === 0) {
              productColors.set(pid, new Set(['white'])); // Default to white
          }
      }
  });
  updateGenerateButtonState(); // Update cost logic
}

// Select All / Deselect All Handlers
function setupSelectionHelpers() {
    // PRODUCTS
    document.getElementById('products-select-all')?.addEventListener('click', () => {
        document.querySelectorAll('.product-card').forEach(card => {
            card.classList.add('selected');
        });
        updateSelectedProducts();
    });

    document.getElementById('products-deselect-all')?.addEventListener('click', () => {
        document.querySelectorAll('.product-card').forEach(card => {
            card.classList.remove('selected');
        });
        updateSelectedProducts();
    });

    // COLORS (Context Aware)
    document.getElementById('color-select-all')?.addEventListener('click', () => {
        if(!activeProductIdForColor) return;
        const gridItems = colorPickerGrid.children;
        // Logic to select all visible options
        Array.from(gridItems).forEach((item: any) => {
           if (!item.classList.contains('selected')) item.click(); 
        });
    });

    document.getElementById('color-deselect-all')?.addEventListener('click', () => {
        if(!activeProductIdForColor) return;
        const gridItems = colorPickerGrid.children;
        Array.from(gridItems).forEach((item: any) => {
           if (item.classList.contains('selected')) item.click(); 
        });
    });
}

function updateGenerateButtonState() {
    let totalImages = 0;
    selectedProductIds.forEach(pid => {
        const colors = productColors.get(pid);
        if(colors) totalImages += colors.size;
    });

    // Assume standard cost
    const costPerImage = API_COSTS.standard; 
    const totalCost = totalImages * costPerImage;

    if (totalImages > 0) {
        generateBtn.textContent = `✨ Generate ${totalImages} Mockups (~$${totalCost.toFixed(2)})`;
    } else {
        generateBtn.textContent = '✨ Generate Mockups';
    }
}


function showEmptyState(container: HTMLElement, config: { icon: string; title: string; description: string; actionText?: string; actionCallback?: () => void; }): void {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${config.icon}</div>
      <div class="empty-state-title">${config.title}</div>
      <div class="empty-state-description">${config.description}</div>
      ${config.actionText ? `<button class="empty-state-action" id="empty-state-action-btn">${config.actionText}</button>` : ''}
    </div>
  `;
  if (config.actionCallback && config.actionText) {
    const actionBtn = container.querySelector('#empty-state-action-btn');
    actionBtn?.addEventListener('click', config.actionCallback);
  }
}

// ... (Keep imports and declarations) ...
declare const google: any;
declare const gapi: any;

const LS_KEYS = {
    THEME: 'mockupGenerator_theme',
    PRESETS: 'mockupGenerator_presets',
};
const MAX_GALLERY_IMAGES = 100;

// --- DOM Elements ---
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const previewImage = document.getElementById('preview-image') as HTMLImageElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const changeDesignBtn = document.getElementById('change-design-btn') as HTMLButtonElement;
const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement;
const resultsContainer = document.getElementById('results-container') as HTMLDivElement;
const gallery = document.getElementById('results-grid') as HTMLDivElement;
const downloadAllBtn = document.getElementById('download-all-btn') as HTMLButtonElement;
const createCollageFromResultsBtn = document.getElementById('create-collage-from-results-btn') as HTMLButtonElement;
const generateListingBtn = document.getElementById('generate-listing-btn') as HTMLButtonElement;
const selectAllBtn = document.getElementById('select-all-btn') as HTMLButtonElement;
const deselectAllBtn = document.getElementById('deselect-all-btn') as HTMLButtonElement;
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
const surpriseMeBtn = document.getElementById('surprise-me-btn') as HTMLButtonElement;

const mainContent = document.getElementById('main-content') as HTMLDivElement;
const designUploadArea = document.getElementById('design-upload-area') as HTMLDivElement;
const designUploadPrompt = document.getElementById('design-upload-prompt') as HTMLDivElement;
const designUploadSpinner = document.getElementById('design-upload-spinner') as HTMLDivElement;

// Navigation Sidebar
const sidebarNavItems = document.querySelectorAll('.nav-item[data-tab]');
const tabContents = document.querySelectorAll('.tab-content');

// Gallery
const persistentGalleryGrid = document.getElementById('persistent-gallery-grid') as HTMLDivElement;
// ... other elements ...

// Modal Elements
const modalViewer = document.getElementById('modal-viewer') as HTMLDivElement;
const modalClose = document.getElementById('modal-close') as HTMLButtonElement;
const modalDelete = document.getElementById('modal-delete') as HTMLButtonElement;
const modalPrev = document.getElementById('modal-prev') as HTMLButtonElement;
const modalNext = document.getElementById('modal-next') as HTMLButtonElement;
const modalImage = document.getElementById('modal-image') as HTMLImageElement;
const modalPromptEl = document.getElementById('modal-prompt') as HTMLParagraphElement;
const modalCopyPromptBtn = document.getElementById('modal-copy-prompt') as HTMLButtonElement;
const modalDownloadBtn = document.getElementById('modal-download-btn') as HTMLButtonElement;
const modalDownloadPromptBtn = document.getElementById('modal-download-prompt') as HTMLButtonElement;

// Color Modal
const colorModal = document.getElementById('color-modal') as HTMLDivElement;
const colorModalOverlay = document.getElementById('color-modal-overlay') as HTMLDivElement;
const colorModalTitle = document.getElementById('color-modal-title') as HTMLHeadingElement;
const colorModalClose = document.getElementById('color-modal-close') as HTMLButtonElement;
const colorPickerGrid = document.getElementById('color-picker-grid') as HTMLDivElement;

// Listing Modal
const listingModal = document.getElementById('listing-modal') as HTMLDivElement;
const listingModalClose = document.getElementById('listing-modal-close') as HTMLButtonElement;
const listingLoading = document.getElementById('listing-loading') as HTMLDivElement;
const listingContent = document.getElementById('listing-content') as HTMLDivElement;
const listingTitle = document.getElementById('listing-title') as HTMLTextAreaElement;
const tagsContainer = document.getElementById('tags-container') as HTMLDivElement;
const copyTitleBtn = document.getElementById('copy-title-btn') as HTMLButtonElement;
const copyTagsBtn = document.getElementById('copy-tags-btn') as HTMLButtonElement;

// Style Controls
const modelControl = document.getElementById('model-control') as HTMLDivElement;
const raceStyleGroup = document.getElementById('race-style-group') as HTMLDivElement;
const raceControl = document.getElementById('race-control') as HTMLDivElement;
const physiqueStyleGroup = document.getElementById('physique-style-group') as HTMLDivElement;
const physiqueControl = document.getElementById('physique-control') as HTMLDivElement;
const generationControl = document.getElementById('generation-control') as HTMLDivElement;

const poseStyleGroup = document.getElementById('pose-style-group') as HTMLDivElement;
const poseControl = document.getElementById('pose-control') as HTMLDivElement;
const displayControl = document.getElementById('display-control') as HTMLDivElement;
const aestheticControl = document.getElementById('aesthetic-control') as HTMLDivElement;
const seasonControl = document.getElementById('season-control') as HTMLDivElement;

// Aspect Ratio
const aspectRatioToggle = document.getElementById('aspect-ratio-toggle') as HTMLInputElement;
const aspectRatioInputs = document.getElementById('aspect-ratio-inputs') as HTMLDivElement;
const aspectRatioWidth = document.getElementById('aspect-ratio-width') as HTMLInputElement;
const aspectRatioHeight = document.getElementById('aspect-ratio-height') as HTMLInputElement;
const qualitySelect = document.getElementById('quality-select') as HTMLSelectElement;

// State
type GalleryImage = {
    id: string; imageUrl: string; prompt: string; productType: string; color: string; timestamp: number;
    isCollage?: boolean; sourceImageCount?: number;
};
type GenerationTask = { product: string; color: string; prompt: string; };

let designFile: { inlineData: { mimeType: string; data: string; } } | null = null;
let customBackgroundFile: any = null;
let generatedImageUrls: { url: string, name: string, product: string, color: string }[] = [];
let galleryImages: GalleryImage[] = [];
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
let currentModalIndex = -1;
let isGenerating = false;
let selectedImageUrls: string[] = [];

// NEW STATE STRUCTURE
let selectedProductIds = new Set<string>();
let productColors = new Map<string, Set<string>>(); // productId -> Set of colorIds

// History
interface AppState {
    quality: 'standard' | 'high' | 'ultra';
    styles: { model: string; race: string; physique: string; pose: string; mood: string; display: string; aesthetic: string; season: string; generation: string; };
    genZ: any; // Gen-Z specific state
    aspectRatio: { enabled: boolean; width: string; height: string; };
    selectedProducts: string[];
    // We'd need to serialize the Map for history, simplification for now:
    selectedColors: any; 
}
let undoStack: AppState[] = [];
let redoStack: AppState[] = [];

// ... (Undo/Redo Logic - Same) ...
function updateHistoryButtons() {
    undoBtn.disabled = undoStack.length <= 1;
    redoBtn.disabled = redoStack.length === 0;
}
function saveState() {
    redoStack = [];
    const currentState = captureState();
    // Simplified history check
    undoStack.push(currentState);
    updateHistoryButtons();
}

function updateConditionalStyles(modelSelection: string) {
    const isModelSelected = modelSelection !== 'none';
    if(raceStyleGroup) raceStyleGroup.classList.toggle('hidden', !isModelSelected);
    if(physiqueStyleGroup) physiqueStyleGroup.classList.toggle('hidden', !isModelSelected);
    // Pose control logic needs to be aware of Gen-Z mode now.
    // We'll handle that in updateGenZControls
    
    // Update Framing/Display Options based on Model
    const displayButtons = displayControl.querySelectorAll('button');
    if (isModelSelected) {
        // Model Mode: Show Waist Up, Full Body, etc.
        displayControl.innerHTML = `
            <button data-value="waist_up" class="active">Waist Up</button>
            <button data-value="full_body">Full Body</button>
            <button data-value="close_up">Close Up</button>
            <button data-value="wide_shot">Wide</button>
        `;
    } else {
        // Product Mode: Show Flat Lay, Hanging, etc.
        displayControl.innerHTML = `
            <button data-value="product-only" class="active">Solo</button>
            <button data-value="hanging">Hang</button>
            <button data-value="folded">Fold</button>
            <button data-value="flatlay">Flat</button>
        `;
    }
}

function updateGenZControls(generation: string) {
    const isGenZ = generation === 'gen_z';
    const genZControls = document.getElementById('genz-specific-controls');
    const legacyPose = document.getElementById('pose-style-group');
    const legacyVibe = document.getElementById('legacy-vibe-group');
    const legacySeason = document.getElementById('legacy-season-group');
    const surpriseBtn = document.getElementById('surprise-me-btn');

    if (genZControls) genZControls.classList.toggle('hidden', !isGenZ);
    if (legacyPose) legacyPose.classList.toggle('hidden', isGenZ); // Hide standard pose if Gen-Z
    if (legacyVibe) legacyVibe.classList.toggle('hidden', isGenZ);
    if (legacySeason) legacySeason.classList.toggle('hidden', isGenZ);
    if (surpriseBtn) surpriseBtn.classList.toggle('hidden', !isGenZ);
    
    // If not Gen-Z, fallback to hiding pose if no model
    if (!isGenZ) {
        const modelVal = document.querySelector('#model-control .active')?.getAttribute('data-value');
        if (legacyPose) legacyPose.classList.toggle('hidden', modelVal === 'none');
    }
}

function updateToggleableInputs(toggle: HTMLInputElement, inputs: HTMLInputElement[]) {
    const isEnabled = toggle.checked;
    inputs.forEach(input => (input.disabled = !isEnabled));
    if (toggle === aspectRatioToggle) aspectRatioInputs.classList.toggle('disabled', !isEnabled);
}

function setupNavigation() {
    sidebarNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.getAttribute('data-tab');
            if(tab) showTab(tab);
        });
    });

    // Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    sidebarToggle?.addEventListener('click', () => {
        sidebar?.classList.toggle('collapsed');
    });
}

async function showTab(tabId: string) {
    sidebarNavItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });
    tabContents.forEach(content => {
        // FIX: Cast to HTMLElement to access dataset
        const contentTabId = (content as HTMLElement).dataset.tabContent;
        content.classList.toggle('active', contentTabId === tabId);
    });
    if (tabId === 'gallery') await loadGalleryFromDB();
    if (tabId === 'collage') updateCollageMakerButtons();
}

// ... (IndexedDB Logic - Same) ...
const DB_NAME = 'MockupGalleryDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';
let db: IDBDatabase;
function initDB(): Promise<boolean> {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) return reject(false);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(false);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        request.onsuccess = () => { db = request.result; resolve(true); };
    });
}
async function saveImageToDB(image: GalleryImage): Promise<void> {
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        transaction.objectStore(STORE_NAME).put(image);
        transaction.oncomplete = () => resolve();
    });
}
function deleteImageFromDB(id: string): Promise<void> {
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        transaction.objectStore(STORE_NAME).delete(id);
        transaction.oncomplete = () => resolve();
    });
}

function displayGalleryImage(entry: GalleryImage): void {
  const imgContainer = document.createElement('div');
  imgContainer.className = 'gallery-item';
  imgContainer.dataset.id = entry.id;
  const img = document.createElement('img');
  img.src = entry.imageUrl;
  img.loading = 'lazy';
  
  // Select Indicator
  const selectIndicator = document.createElement('div');
  selectIndicator.className = 'select-indicator';
  selectIndicator.innerHTML = '✓';
  selectIndicator.onclick = (e) => {
      e.stopPropagation();
      imgContainer.classList.toggle('selected');
      updateCollageMakerButtons();
  };
  
  imgContainer.onclick = () => {
      const idx = galleryImages.findIndex(g => g.id === entry.id);
      openModal(idx);
  }

  imgContainer.appendChild(img);
  imgContainer.appendChild(selectIndicator);
  persistentGalleryGrid.appendChild(imgContainer);
}

async function loadGalleryFromDB(): Promise<void> {
    // Logic same as before
    return new Promise((resolve) => {
        if (!db) return resolve();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const request = transaction.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => {
            const entries = request.result as GalleryImage[];
            persistentGalleryGrid.innerHTML = '';
            if(entries.length === 0) {
                showEmptyState(persistentGalleryGrid, { icon: '🖼️', title: 'Empty Gallery', description: 'No images yet.' });
                resolve(); return;
            }
            entries.sort((a, b) => b.timestamp - a.timestamp);
            galleryImages = entries;
            entries.slice(0, MAX_GALLERY_IMAGES).forEach(displayGalleryImage);
            updateCollageMakerButtons();
            resolve();
        }
    });
}

// ... (File Handling Helpers - Same) ...
function fileToGenerativePart(file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ inlineData: { mimeType: file.type, data: (reader.result as string).split(',')[1] } });
        reader.readAsDataURL(file);
    });
}
function dataUrlToGenerativePart(dataUrl: string): { inlineData: { mimeType: string; data: string; } } | null {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    return match ? { inlineData: { mimeType: match[1], data: match[2] } } : null;
}
function preprocessImageForAI(file: File): Promise<{ inlineData: { mimeType: string; data:string; } }> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                canvas.width = img.width; canvas.height = img.height;
                ctx.fillStyle = '#E0E0E0'; ctx.fillRect(0,0,canvas.width,canvas.height);
                ctx.drawImage(img,0,0);
                resolve(dataUrlToGenerativePart(canvas.toDataURL('image/jpeg',0.95))!);
            };
            img.src = e.target!.result as string;
        };
        reader.readAsDataURL(file);
    });
}

async function handleFile(file: File) {
    if (!file || !file.type.startsWith('image/')) return alert('Invalid file');
    designUploadPrompt.classList.add('hidden');
    designUploadSpinner.classList.remove('hidden');
    try {
        const originalPart = await fileToGenerativePart(file);
        previewImage.src = `data:${originalPart.inlineData.mimeType};base64,${originalPart.inlineData.data}`;
        designFile = await preprocessImageForAI(file);
        designUploadArea.classList.add('hidden');
        previewImage.classList.remove('hidden');
        generateBtn.disabled = false;
        if(undoStack.length===0) saveState();
    } catch (e) {
        console.error(e);
        designUploadSpinner.classList.add('hidden');
        designUploadPrompt.classList.remove('hidden');
    }
}

// ... (Generation Logic - Updated) ...
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function generateImage(task: GenerationTask, index: number, totalTasks: number): Promise<{url: string, name: string, product: string, color: string} | null> {
    const startTime = Date.now();
    const galleryItem = gallery.children[index] as HTMLDivElement;
    const currentState = captureState();
    
    const promptConfig: PromptConfig = {
      design: `User design`,
      productType: task.product,
      color: task.color,
      style: { ...currentState.styles },
      genZ: currentState.genZ,
      background: 'neutral',
      quality: currentState.quality,
    };
    // Variations logic
    if (totalTasks > 1) {
         const poses = ['standing', 'walking', 'sitting'];
         if (promptConfig.style.model !== 'none') {
             // promptConfig.style.pose = poses[index % poses.length]; // Keep strict selection
         }
    }

    const prompt = buildOptimizedPrompt(promptConfig);
    const parts: any[] = [designFile!, { text: prompt }];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE] }
        });
        const imgPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imgPart) {
            const url = `data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`;
            const name = `mockup_${Date.now()}.png`;
            trackGeneration(currentState.quality, true, Date.now() - startTime);
            
            // Update DOM with Image and Click Handler
            galleryItem.className = 'gallery-item';
            galleryItem.innerHTML = ''; // Clear loading state
            const img = document.createElement('img');
            img.src = url;
            img.alt = "Generated Mockup";
            
            // Create entry with ID immediately for modal
            const newImgEntry: GalleryImage = {
                id: Date.now().toString() + Math.random().toString(), // Ensure unique ID
                imageUrl: url,
                prompt: prompt,
                productType: task.product,
                color: task.color,
                timestamp: Date.now()
            };

            // Save to DB
            await saveImageToDB(newImgEntry);
            // Add to local galleryImages for modal reference
            galleryImages.unshift(newImgEntry);

            // Select Indicator
            const selectIndicator = document.createElement('div');
            selectIndicator.className = 'select-indicator';
            selectIndicator.innerHTML = '✓';
            selectIndicator.onclick = (e) => {
                e.stopPropagation();
                galleryItem.classList.toggle('selected');
            };

            galleryItem.onclick = () => {
                // Open Modal
                 const idx = galleryImages.findIndex(g => g.id === newImgEntry.id);
                 if (idx !== -1) openModal(idx);
            };
            
            galleryItem.appendChild(img);
            galleryItem.appendChild(selectIndicator);

            return { url, name, product: task.product, color: task.color };
        }
    } catch (e) { console.error(e); }
    
    trackGeneration(currentState.quality, false, Date.now() - startTime);
    galleryItem.className = 'gallery-item error';
    galleryItem.innerHTML = 'Failed';
    return null;
}

function getGenerationTasks(): GenerationTask[] {
    const tasks: GenerationTask[] = [];
    selectedProductIds.forEach(pid => {
        const colors = productColors.get(pid);
        if(colors && colors.size > 0) {
            colors.forEach(cid => {
                // FIX: Check ALL color arrays to find the name
                let colorName = cid;
                const allColors = [...DEFAULT_COLOR_OPTIONS, ...GILDAN_5000_COLORS, ...GILDAN_18500_COLORS, ...GILDAN_18000_COLORS];
                const found = allColors.find(c => c.id === cid);
                if (found) colorName = found.name;

                tasks.push({ 
                    product: PRODUCT_OPTIONS.find(p=>p.id===pid)?.name || pid, 
                    color: colorName, 
                    prompt: '' 
                });
            });
        }
    });
    return tasks;
}

async function handleGenerate() {
    if (isGenerating) return;
    const tasks = getGenerationTasks();
    if (!designFile) return alert('Upload design first');
    if (tasks.length === 0) return alert('Select at least one product and one color');
    
    // SAFETY CHECK: Warn if generating many images
    if (tasks.length > 5) {
        const costEstimate = (tasks.length * 0.05).toFixed(2);
        const confirmMsg = `⚠️ You are about to generate ${tasks.length} images.\n\nEstimated Cost: ~$${costEstimate}\n\nDo you want to proceed?`;
        if (!confirm(confirmMsg)) return;
    }

    isGenerating = true;
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    gallery.innerHTML = ''; // Clear Results
    document.getElementById('results-empty-state')!.classList.add('hidden');
    generatedImageUrls = [];
    
    // Progress Bar
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-percent');
    const statusText = document.getElementById('progress-text');
    if(progressContainer) progressContainer.classList.remove('hidden');
    
    tasks.forEach(() => {
        const div = document.createElement('div');
        div.className = 'gallery-item loading';
        div.innerHTML = '<div class="spinner"></div>';
        gallery.appendChild(div);
    });
    
    const results = [];
    for(let i=0; i<tasks.length; i++) {
        // Update Progress
        const percent = Math.round(((i) / tasks.length) * 100);
        if(progressBar) progressBar.style.width = `${percent}%`;
        if(progressText) progressText.textContent = `${percent}%`;
        if(statusText) statusText.textContent = `Generating ${tasks[i].color} ${tasks[i].product}...`;

        results.push(await generateImage(tasks[i], i, tasks.length));
        if(i<tasks.length-1) await delay(500);
    }
    
    // Complete
    if(progressBar) progressBar.style.width = `100%`;
    if(progressText) progressText.textContent = `100%`;
    if(statusText) statusText.textContent = `Done!`;
    setTimeout(() => { if(progressContainer) progressContainer.classList.add('hidden'); }, 2000);

    generatedImageUrls = results.filter(r => r!==null) as any;
    isGenerating = false;
    generateBtn.disabled = false;
    updateGenerateButtonState(); // Reset button text
    
    if(generatedImageUrls.length > 0) {
        downloadAllBtn.classList.remove('hidden');
        document.querySelectorAll('#results-container button.hidden').forEach(b => b.classList.remove('hidden'));
    }
}

// ========================================
// RESULTS HANDLERS (New)
// ========================================
async function handleDownloadResults() {
    const items = document.querySelectorAll('#results-grid .gallery-item');
    const selected = document.querySelectorAll('#results-grid .gallery-item.selected');
    const targetItems = selected.length > 0 ? selected : items;

    if (targetItems.length === 0) return alert('No images to download');

    const zip = new JSZip();
    const folder = zip.folder("mockups");

    let count = 0;
    targetItems.forEach((item, index) => {
        const img = item.querySelector('img') as HTMLImageElement;
        if (img && img.src.startsWith('data:')) {
             const data = img.src.split(',')[1];
             folder?.file(`mockup_${index + 1}.png`, data, {base64: true});
             count++;
        }
    });
    
    if(count === 0) return alert('No valid images found to zip.');

    const content = await zip.generateAsync({type:"blob"});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = "mockups.zip";
    link.click();
}

async function handleCollageFromResults() {
    const selected = document.querySelectorAll('#results-grid .gallery-item.selected');
    const targetItems = selected.length > 0 ? selected : document.querySelectorAll('#results-grid .gallery-item');

    if (targetItems.length < 1) return alert('Select at least 1 image for collage');
    if (targetItems.length > 9) return alert('Max 9 images');

    const urls: string[] = [];
    targetItems.forEach(item => {
        const img = item.querySelector('img') as HTMLImageElement;
        if(img) urls.push(img.src);
    });

    try {
        const collageUrl = await generateCollage(urls);
        const modalImg = document.getElementById('modal-image') as HTMLImageElement;
        modalImg.src = collageUrl;
        const promptEl = document.getElementById('modal-prompt');
        if (promptEl) promptEl.textContent = "Collage generated from results";
        
        document.getElementById('modal-viewer')?.classList.remove('hidden');
    } catch(e) {
        console.error(e);
        alert('Failed to generate collage');
    }
}

function handleResultSelectAll() {
    document.querySelectorAll('#results-grid .gallery-item').forEach(item => item.classList.add('selected'));
}
function handleResultDeselectAll() {
    document.querySelectorAll('#results-grid .gallery-item').forEach(item => item.classList.remove('selected'));
}


// ... (Capture/Apply State - Updated for GenZ) ...
function captureState(): AppState {
    const getActiveValue = (c: HTMLElement) => c.querySelector('.active')?.getAttribute('data-value') || '';
    
    // Capture Gen-Z specific fields
    const getVal = (id: string) => (document.getElementById(id) as HTMLSelectElement | HTMLInputElement)?.value;
    const getCheckedValues = (name: string) => {
        return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
          .map((el: any) => el.value);
    };

    return {
        quality: qualitySelect.value as any,
        styles: {
            model: getActiveValue(modelControl),
            race: getActiveValue(raceControl),
            physique: getActiveValue(physiqueControl),
            pose: getActiveValue(poseControl),
            mood: '', // Simplified
            display: getActiveValue(displayControl),
            aesthetic: getActiveValue(aestheticControl),
            season: getActiveValue(seasonControl),
            generation: getActiveValue(generationControl),
        },
        genZ: {
            location: getVal('genz-location'),
            lighting: getVal('genz-lighting'),
            bodyPose: getVal('genz-body-pose'),
            handAction: getVal('genz-hand-action'),
            expression: getVal('genz-expression'),
            accessories: getCheckedValues('genz-accessory')
        },
        aspectRatio: { enabled: aspectRatioToggle.checked, width: aspectRatioWidth.value, height: aspectRatioHeight.value },
        selectedProducts: Array.from(selectedProductIds),
        selectedColors: null
    };
}

function handleSurpriseMe() {
    // Force Gen-Z Mode
    const genCtrl = document.getElementById('generation-control');
    const genZBtn = genCtrl?.querySelector('[data-value="gen_z"]');
    if(genZBtn) (genZBtn as HTMLElement).click();

    // Helper to randomize select
    const randSelect = (id: string, options: any[]) => {
        const el = document.getElementById(id) as HTMLSelectElement;
        if(el && options.length) {
            const rand = options[Math.floor(Math.random() * options.length)];
            el.value = rand;
        }
    };

    // Randomize
    randSelect('genz-location', GENZ_LOCATIONS);
    randSelect('genz-lighting', GENZ_LIGHTING);
    randSelect('genz-body-pose', GENZ_POSES);
    randSelect('genz-hand-action', GENZ_ACTIONS);
    randSelect('genz-expression', GENZ_EXPRESSIONS);

    // Randomize Accessories
    document.querySelectorAll('input[name="genz-accessory"]').forEach((cb: any) => {
        cb.checked = Math.random() > 0.8; 
    });

    // Randomize Product (if none selected, pick one)
    if(selectedProductIds.size === 0) {
        const productCards = document.querySelectorAll('.product-card');
        const randCard = productCards[Math.floor(Math.random() * productCards.length)] as HTMLElement;
        randCard.click();
    }
    
    // Randomize Color (simple - just pick one for the selected products)
    selectedProductIds.forEach(pid => {
        if (!productColors.has(pid)) {
             productColors.set(pid, new Set(['black'])); // default
        }
    });
    
    updateGenerateButtonState();
}

function populateGenZDropdowns() {
    const fill = (id: string, opts: string[]) => {
        const sel = document.getElementById(id) as HTMLSelectElement;
        if(!sel) return;
        sel.innerHTML = '';
        opts.forEach(o => {
            const op = document.createElement('option');
            op.value = o;
            op.text = o;
            sel.appendChild(op);
        });
    };

    fill('genz-location', GENZ_LOCATIONS);
    fill('genz-lighting', GENZ_LIGHTING);
    fill('genz-body-pose', GENZ_POSES);
    fill('genz-hand-action', GENZ_ACTIONS);
    fill('genz-expression', GENZ_EXPRESSIONS);

    // Accessories Checkboxes
    const accContainer = document.getElementById('genz-accessories');
    if(accContainer) {
        accContainer.innerHTML = '';
        GENZ_ACCESSORIES.forEach(acc => {
            const label = document.createElement('label');
            label.className = 'checkbox-wrapper';
            label.style.fontSize = '0.9rem';
            label.innerHTML = `
                <input type="checkbox" name="genz-accessory" value="${acc.id}">
                <span>${acc.label}</span>
            `;
            accContainer.appendChild(label);
        });
    }
}

function setupResultInteractions() {
     // Wire up Results Buttons
    downloadAllBtn.addEventListener('click', handleDownloadResults);
    createCollageFromResultsBtn.addEventListener('click', handleCollageFromResults);
    selectAllBtn.addEventListener('click', handleResultSelectAll);
    deselectAllBtn.addEventListener('click', handleResultDeselectAll);

    // Modal Copy Prompt
    if (modalCopyPromptBtn && modalPromptEl) {
        modalCopyPromptBtn.addEventListener('click', () => {
            const text = modalPromptEl.textContent;
            if(text) {
                navigator.clipboard.writeText(text);
                const originalHtml = modalCopyPromptBtn.innerHTML;
                modalCopyPromptBtn.innerHTML = '✓';
                setTimeout(() => modalCopyPromptBtn.innerHTML = originalHtml, 2000);
            }
        });
    }

    // Modal Download Prompt
    if (modalDownloadPromptBtn && modalPromptEl) {
        modalDownloadPromptBtn.addEventListener('click', () => {
            const text = modalPromptEl.textContent;
            if(!text) return;
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `prompt_${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

     // Modal Download Image (Add listener if not already there)
     const modalDownloadImageBtn = document.getElementById('modal-download-btn');
     modalDownloadImageBtn?.addEventListener('click', () => {
        const img = document.getElementById('modal-image') as HTMLImageElement;
        if(img && img.src) {
             const a = document.createElement('a');
            a.href = img.src;
            a.download = `mockup_${Date.now()}.png`;
            a.click();
        }
     });
}


function openModal(index: number) {
    if (index < 0 || index >= galleryImages.length) return;
    currentModalIndex = index;
    const img = galleryImages[index];
    modalImage.src = img.imageUrl;
    modalPromptEl.textContent = img.prompt;
    modalViewer.classList.remove('hidden');
}

function updateCollageMakerButtons() {
    const btn = document.getElementById('create-collage-btn') as HTMLButtonElement;
    // Re-implement click selection logic for persistent gallery
    const count = document.querySelectorAll('#persistent-gallery-grid .gallery-item.selected').length;
    btn.disabled = count < 1 || count > 9;
    btn.textContent = `🎨 Create Collage (${count})`;
}

// ... (Init) ...
function init() {
    console.log('MonAmi App Initialized');
    const savedTheme = localStorage.getItem(LS_KEYS.THEME) || 'light';
    document.body.dataset.theme = savedTheme;
    themeToggle.addEventListener('click', () => {
        const newTheme = document.body.dataset.theme === 'light' ? 'dark' : 'light';
        document.body.dataset.theme = newTheme;
        localStorage.setItem(LS_KEYS.THEME, newTheme);
    });
    
    setupNavigation();
    
    // Dashboard Actions
    document.getElementById('action-create')?.addEventListener('click', () => showTab('create'));
    // Removed action-gallery listener
    
    fileInput.addEventListener('change', () => fileInput.files?.[0] && handleFile(fileInput.files[0]));
    designUploadArea.addEventListener('click', () => fileInput.click());
    generateBtn.addEventListener('click', handleGenerate);
    surpriseMeBtn.addEventListener('click', handleSurpriseMe);
    
    setupResultInteractions();
    setupSelectionHelpers();
    setupStatsReset();
    
    document.querySelectorAll('.segmented-control').forEach(g => {
        g.addEventListener('click', (e) => {
            const t = e.target as HTMLElement;
            if(t.tagName==='BUTTON') {
                g.querySelector('.active')?.classList.remove('active');
                t.classList.add('active');
                if(g.id === 'model-control') updateConditionalStyles(t.dataset.value!);
                if(g.id === 'generation-control') updateGenZControls(t.dataset.value!);
                saveState();
            }
        });
    });
    
    // Modals
    colorModalClose.addEventListener('click', () => colorModal.classList.add('hidden'));
    modalClose.addEventListener('click', () => modalViewer.classList.add('hidden'));
    
    initDB().then(() => {
        loadGalleryFromDB(); 
        showTab('dashboard'); // Start on Dashboard
        loadCostMetrics();
        updateCostDisplay();
    });
    
    initAccordions();
    generateProductCards();
    populateGenZDropdowns();
}

init();
