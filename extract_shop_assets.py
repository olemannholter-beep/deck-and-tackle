"""
Automated Sprite & UI Asset Extraction for Chandlery Shop
Extracts modular environment slices, standalone NPC sprite with pipe smoke,
UI components, and technique/relic woodcut icons with transparency masking.
"""

import os
import sys
import shutil
import time
from typing import Dict, Tuple, Optional
from PIL import Image
import numpy as np

# Optional imports for neural masking
try:
    import rembg
    HAS_REMBG = True
except ImportError:
    HAS_REMBG = False

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


def find_source_image() -> str:
    """Finds the Chandlery concept art across common relative locations."""
    candidate_paths = [
        "./chandlery_concept.png",
        "./images/chandlery_concept.png",
        "./deck-and-tackle/asset/images/chandlery_concept.png",
        "./asset/images/chandlery_concept.png",
        "../images/chandlery_concept.png",
        "../chandlery_concept.png",
    ]
    for path in candidate_paths:
        if os.path.exists(path):
            return os.path.abspath(path)
    raise FileNotFoundError(
        "Could not find chandlery_concept.png. Checked paths:\n" +
        "\n".join(candidate_paths)
    )


def refine_icon_transparency(img_rgba: Image.Image, img_rgb: Image.Image) -> Image.Image:
    """
    Refines woodcut icon transparency:
    Removes residual parchment background while preserving dark woodcut ink and subtle gradients.
    """
    arr_rgba = np.array(img_rgba.convert('RGBA'))
    arr_rgb = np.array(img_rgb.convert('RGB')).astype(float)
    
    # Calculate parchment/paper lightness
    gray = 0.299 * arr_rgb[:, :, 0] + 0.587 * arr_rgb[:, :, 1] + 0.114 * arr_rgb[:, :, 2]
    
    alpha = arr_rgba[:, :, 3].copy().astype(float)
    
    # Paper threshold: parchment background is typically > 130 lightness
    # Attenuate alpha where parchment paper is present
    paper_mask = gray > 125
    attenuation = np.clip((160.0 - gray) / 35.0, 0.0, 1.0)
    alpha[paper_mask] = alpha[paper_mask] * attenuation[paper_mask]
    
    arr_rgba[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return Image.fromarray(arr_rgba, mode='RGBA')


def extract_assets():
    source_path = find_source_image()
    print(f"[+] Loaded source concept art: {source_path}")
    
    base_img = Image.open(source_path)
    w, h = base_img.size
    print(f"[+] Concept dimensions: {w} x {h} px (Mode: {base_img.mode})")
    
    # Ensure primary output directory exists
    output_dir = os.path.abspath("./assets/sprites/shop")
    os.makedirs(output_dir, exist_ok=True)
    
    # Also support game public directory if present in deck-and-tackle
    secondary_output_dirs = [
        os.path.abspath("./deck-and-tackle/public/assets/sprites/shop"),
        os.path.abspath("./deck-and-tackle/asset/sprites/shop"),
    ]
    for s_dir in secondary_output_dirs:
        os.makedirs(s_dir, exist_ok=True)
    
    # Initialize rembg session if available
    rembg_session = None
    if HAS_REMBG:
        print("[+] Initializing rembg session for neural background removal...")
        try:
            rembg_session = rembg.new_session()
            print("[+] rembg session ready.")
        except Exception as e:
            print(f"[!] Warning: Failed to init rembg session ({e}). Falling back to standard masking.")
    
    # Crop definitions: (Category, Filename, (X1%, Y1%, X2%, Y2%), ApplyTransparency)
    tasks = [
        # 1. Environment & Modular Plates (Left Side)
        (
            "Environment Plate",
            "shop_left_diorama_bg.png",
            (0.00, 0.00, 0.52, 1.00),
            False,
            "Full left merchant shanty / aquarium interior cutaway"
        ),
        (
            "NPC Sprite",
            "fisherman_merchant.png",
            (0.36, 0.35, 0.45, 0.65),
            True,
            "Bearded shopkeeper in yellow oilskin slicker with pipe smoke"
        ),
        (
            "Modular Environment",
            "specimen_aquarium.png",
            (0.00, 0.30, 0.30, 0.94),
            False,
            "Glowing deep-sea creature tank with riveted iron & wire mesh"
        ),
        
        # 2. Grimoire Ledger & Shop UI Framing (Right Side)
        (
            "UI Ledger Frame",
            "grimoire_ledger_book.png",
            (0.53, 0.10, 0.99, 0.94),
            False,
            "Open ledger book with weathered parchment and rope trim"
        ),
        (
            "UI Banner",
            "ui_header_bar.png",
            (0.52, 0.02, 0.99, 0.10),
            False,
            "Top title header banner 'CHANDLERY & GRIMOIRE LEDGER'"
        ),
        (
            "UI Container Plate",
            "parchment_item_plate.png",
            (0.58, 0.15, 0.75, 0.33),
            False,
            "Modular parchment item card container rectangle"
        ),
        
        # 3. Technique & Relic Woodcut Icons
        (
            "Item Icon",
            "icon_black_iron_winch.png",
            (0.58, 0.21, 0.64, 0.31),
            True,
            "Woodcut engraving: Black Iron Winch"
        ),
        (
            "Item Icon",
            "icon_eldritch_lure.png",
            (0.77, 0.21, 0.835, 0.31),
            True,
            "Woodcut engraving: Eldritch Lure"
        ),
        (
            "Item Icon",
            "icon_kelp_snare.png",
            (0.58, 0.39, 0.64, 0.49),
            True,
            "Woodcut engraving: Kelp Snare Drag"
        ),
        (
            "Item Icon",
            "icon_dagons_barbed_hook.png",
            (0.77, 0.39, 0.835, 0.49),
            True,
            "Woodcut engraving: Dagon's Barbed Hook"
        ),
        (
            "Item Icon",
            "icon_void_pump.png",
            (0.58, 0.57, 0.64, 0.67),
            True,
            "Woodcut engraving: Void Pump"
        ),
        (
            "Item Icon",
            "icon_abyssal_chum.png",
            (0.77, 0.57, 0.835, 0.67),
            True,
            "Woodcut engraving: Abyssal Chum"
        ),
        (
            "Item Icon",
            "icon_cyclopean_gantry.png",
            (0.58, 0.75, 0.64, 0.85),
            True,
            "Woodcut engraving: Cyclopean Gantry"
        ),
    ]
    
    results = []
    
    print("\n[+] Starting extraction pipeline...")
    for cat, filename, (x1, y1, x2, y2), needs_transparency, desc in tasks:
        px1, py1 = int(round(x1 * w)), int(round(y1 * h))
        px2, py2 = int(round(x2 * w)), int(round(y2 * h))
        
        crop_w = px2 - px1
        crop_h = py2 - py1
        
        cropped = base_img.crop((px1, py1, px2, py2))
        
        if needs_transparency:
            t0 = time.time()
            if HAS_REMBG and rembg_session is not None:
                # Remove background with rembg neural network
                rgba_crop = rembg.remove(cropped, session=rembg_session)
                
                # For icons, refine alpha to eliminate residual parchment paper
                if "icon_" in filename:
                    final_crop = refine_icon_transparency(rgba_crop, cropped)
                else:
                    final_crop = rgba_crop
            else:
                # Fallback luminance / color thresholding
                final_crop = refine_icon_transparency(cropped.convert("RGBA"), cropped)
            
            elapsed = time.time() - t0
            arr = np.array(final_crop)
            alpha = arr[:, :, 3]
            trans_pct = float((alpha == 0).mean() * 100.0)
            semi_pct = float(((alpha > 0) & (alpha < 255)).mean() * 100.0)
            trans_info = f"Yes (RGBA, {trans_pct:.1f}% trans, {semi_pct:.1f}% soft edges)"
        else:
            final_crop = cropped.convert("RGB")
            trans_info = "No (RGB Opaque)"
        
        # Save to primary destination
        target_path = os.path.join(output_dir, filename)
        final_crop.save(target_path, format="PNG")
        
        # Replicate to secondary game directories
        for s_dir in secondary_output_dirs:
            sec_path = os.path.join(s_dir, filename)
            final_crop.save(sec_path, format="PNG")
            
        file_size_kb = os.path.getsize(target_path) / 1024.0
        
        results.append({
            "category": cat,
            "filename": filename,
            "dimensions": f"{final_crop.width}x{final_crop.height}",
            "coords_pct": f"X: {x1*100:.1f}-{x2*100:.1f}%, Y: {y1*100:.1f}-{y2*100:.1f}%",
            "coords_px": f"({px1}, {py1}) to ({px2}, {py2})",
            "transparency": trans_info,
            "size_kb": f"{file_size_kb:.1f} KB",
            "description": desc,
        })
        print(f"  -> Extracted: {filename:<28s} [{final_crop.width:4d}x{final_crop.height:4d} px] | {trans_info}")

    # Print summary table
    print("\n" + "=" * 128)
    print("CHANDLERY SHOP SPRITE & UI ASSET EXTRACTION SUMMARY")
    print("=" * 128)
    header = f"{'Category':<18s} | {'Filename':<30s} | {'Dimensions':<11s} | {'Bounding Pixels (X1,Y1)->(X2,Y2)':<30s} | {'Transparency Applied':<26s}"
    print(header)
    print("-" * 128)
    for r in results:
        line = f"{r['category']:<18s} | {r['filename']:<30s} | {r['dimensions']:<11s} | {r['coords_px']:<30s} | {r['transparency']:<26s}"
        print(line)
    print("=" * 128)
    print(f"[+] Output directory: {output_dir}")
    print(f"[+] Synchronized to:  {secondary_output_dirs[0]}")
    print(f"[+] Total assets generated: {len(results)}\n")
    return results


if __name__ == "__main__":
    extract_assets()
