/**
 * nodes/index.js — registers every built-in node type.
 *
 * Importing this module for its side effects populates the registry. Adding a
 * new node is: create the file, register itself, add one import line here.
 * (This is the whole "new nodes extend nothing, they register" story from
 * docs/NODE_EDITOR_PLAN.md §4.)
 */

import './solidColor.js';
import './noise.js';
import './voronoi.js';
import './cracks.js';
import './skyGradient.js';
import './textureImport.js';
import './gradient.js';
import './levels.js';
import './curves.js';
import './hsv.js';
import './tint.js';
import './brightnessContrast.js';
import './invert.js';
import './clamp.js';
import './threshold.js';
import './blur.js';
import './sharpen.js';
import './warp.js';
import './swirl.js';
import './glow.js';
import './gradientMap.js';
import './transform.js';
import './flip.js';
import './tile.js';
import './seamless.js';
import './uvRegion.js';
import './cirrus.js';
import './alphaRamp.js';
import './blend.js';
import './layers.js';
import './channelCombine.js';
import './combineRgbAlpha.js';
import './alphaSubtract.js';
import './mask.js';
import './scatter.js';
import './output.js';
