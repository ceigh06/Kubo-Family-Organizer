import { describe, it, expect } from 'vitest';
import {
  parseMedicineLabel,
  cleanOcrArtifacts,
  levenshteinDistance,
  stringSimilarity,
  detectMedicineBoundingBox,
} from '@/ai/ocr';

describe('Medicine OCR Parser & Phone Camera Enhancements', () => {
  describe('OCR Artifact Cleaner (cleanOcrArtifacts)', () => {
    it('cleans common OCR noise like "rng" -> "mg" and letter O in dosage', () => {
      const dirty = 'Take 5OOmg or 50rng with water';
      const cleaned = cleanOcrArtifacts(dirty);
      expect(cleaned).toContain('500 mg');
      expect(cleaned).toContain('50 mg');
    });

    it('cleans OCR letter l / I / pipe into digit 1 for counts and administration', () => {
      const dirty = 'Take l tablet every 4 hours. Box of l0 tablets.';
      const cleaned = cleanOcrArtifacts(dirty);
      expect(cleaned).toContain('Take 1 tablet');
      expect(cleaned).toContain('10 tablets');
    });

    it('corrects "rn" into "m" in common pharmaceutical vocabulary', () => {
      const dirty = 'paracetarnol 500mg, arnoxicillin 250mg, rnaintenance';
      const cleaned = cleanOcrArtifacts(dirty);
      expect(cleaned).toContain('paracetamol');
      expect(cleaned).toContain('amoxicillin');
      expect(cleaned).toContain('maintenance');
    });
  });

  describe('Fuzzy String Distance (Levenshtein & Similarity)', () => {
    it('computes accurate Levenshtein distance on single-character mutations', () => {
      expect(levenshteinDistance('biogesic', 'bi0gesic')).toBe(1);
      expect(levenshteinDistance('losartan', 'l0sartan')).toBe(1);
      expect(levenshteinDistance('amoxicillin', 'amoxicilin')).toBe(1);
    });

    it('computes high similarity for typical phone OCR misreadings', () => {
      expect(stringSimilarity('biogesic', 'bi0gesic')).toBeGreaterThanOrEqual(0.85);
      expect(stringSimilarity('losartan potassium', 'l0sartan potassium')).toBeGreaterThanOrEqual(0.9);
      expect(stringSimilarity('paracetamol', 'paracetam0l')).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('End-to-End Phone Photo OCR Simulation', () => {
    it('correctly matches Biogesic with phone camera typo "BI0GESIC" (digit 0)', () => {
      const phoneOcrOutput = `
        BI0GESIC
        Paracetam0l 5OOmg
        For fever and pain
        Take l tablet every 4 hours
        l0 Tablets
      `;
      const result = parseMedicineLabel(phoneOcrOutput);

      expect(result.name).toBe('Biogesic (Paracetamol)');
      expect(result.dosage).toContain('500 mg');
      expect(result.type).toBe('PRN');
      expect(result.stock).toBe('10');
      expect(result.confidence).toBeGreaterThan(0.75);
    });

    it('correctly matches Losartan with phone camera noise "L0SARTAN 5Orng"', () => {
      const phoneOcrOutput = `
        L0SARTAN POTASSIUM
        5Orng Film-Coated Tablet
        Antihypertensive rnaintenance dose
        Take once daily
        30 tablets
      `;
      const result = parseMedicineLabel(phoneOcrOutput);

      expect(result.name).toBe('Losartan Potassium');
      expect(result.dosage).toContain('50 mg');
      expect(result.type).toBe('maintenance');
      expect(result.timesPerDay).toBe(1);
      expect(result.stock).toBe('30');
    });

    it('correctly matches Amoxicillin with typo "AMOXICILIN" and "500rng"', () => {
      const phoneOcrOutput = `
        Amoxicilin Trihydrate
        500rng Capsules
        Take l capsule every 8 hours
        21 capsules
      `;
      const result = parseMedicineLabel(phoneOcrOutput);

      expect(result.name).toBe('Amoxicillin');
      expect(result.dosage).toContain('500 mg');
      expect(result.type).toBe('maintenance');
      expect(result.timesPerDay).toBe(3);
      expect(result.stock).toBe('21');
    });

    it('correctly matches Neozep Forte with OCR noise "NE0ZEP FORTE"', () => {
      const phoneOcrOutput = `
        NE0ZEP FORTE
        Phenylephrine HCl + Chlorphenamine + Paracetamol
        For relief of clogged nose
        Take l tablet every 6 hours as needed
      `;
      const result = parseMedicineLabel(phoneOcrOutput);

      expect(result.name).toBe('Neozep Forte');
      expect(result.type).toBe('PRN');
      expect(result.minIntervalHours).toBe('6');
    });

    it('correctly parses non-catalog medicine captured on phone', () => {
      const phoneOcrOutput = `
        CLARICHEM-250
        250rng Capsule
        Take with meals
        14 capsules
      `;
      const result = parseMedicineLabel(phoneOcrOutput);

      expect(result.name).toBe('CLARICHEM-250');
      expect(result.dosage).toContain('250 mg');
      expect(result.stock).toBe('14');
    });
  });

  describe('Real-World Phone Photo Scenarios (User Photo Test Set)', () => {
    it('correctly parses Calamine Lotion 8% (60 mL bottle)', () => {
      const ocrOutput = `
        CALAMINE
        8% LOTION
        Antipruritic / Skin Protectant
        60 mL
        JCHEMIE LABORATORIES INC.
      `;
      const result = parseMedicineLabel(ocrOutput);
      expect(result.name).toBe('Calamine Lotion');
      expect(result.dosage).toContain('8% lotion');
      expect(result.dosage).toContain('60 mL');
      expect(result.type).toBe('PRN');
    });

    it('correctly parses Furosemide (Uromid) 40 mg from blister pack', () => {
      const ocrOutput = `
        FUROSEMIDE
        40 mg
        UROMID 40
        Diuretic
        Take 1 tablet in the morning
        10 tablets
      `;
      const result = parseMedicineLabel(ocrOutput);
      expect(result.name).toBe('Furosemide (Uromid)');
      expect(result.dosage).toContain('40 mg');
      expect(result.type).toBe('maintenance');
      expect(result.stock).toBe('10');
    });

    it('correctly parses Amlodipine Besylate (Lodibes) 5 mg', () => {
      const ocrOutput = `
        AMLODIPINE BESYLATE
        LODIBES 5
        5 mg
        Antihypertensive
        Take once daily
        10 tablets
      `;
      const result = parseMedicineLabel(ocrOutput);
      expect(result.name).toBe('Amlodipine Besylate');
      expect(result.dosage).toContain('5 mg');
      expect(result.type).toBe('maintenance');
      expect(result.stock).toBe('10');
    });

    it('correctly parses Biogesic / Paracetamol 500 mg angled blue foil blister', () => {
      const ocrOutput = `
        PARACETAMOL
        BIOGESIC
        500 mg
        UNILAB
        For fever and headache
        Take 1 tablet every 4 to 6 hours
        20 tablets
      `;
      const result = parseMedicineLabel(ocrOutput);
      expect(result.name).toBe('Biogesic (Paracetamol)');
      expect(result.dosage).toContain('500 mg');
      expect(result.type).toBe('PRN');
      expect(result.stock).toBe('20');
      expect(result.minIntervalHours).toBe('4');
    });

    it('correctly parses Actimed Clopidogrel 75 mg from cropped blister', () => {
      const ocrOutput = `
        Actimed
        Clopidogrel
        75 mg Film-Coated Tablet
        ANTITHROMBOTIC
        Rx
        Batch No.: CT1045
        30 tablets
      `;
      const result = parseMedicineLabel(ocrOutput);
      expect(result.name).toBe('Clopidogrel (Actimed)');
      expect(result.dosage).toContain('75 mg');
      expect(result.type).toBe('maintenance');
      expect(result.stock).toBe('30');
    });

    it('correctly parses Dapagliflozin 10 mg (Dapafast) from red packet crop', () => {
      const ocrOutput = `
        DAPAGLIFLOZIN
        DAPAFAST
        10 mg Film-Coated Tablet
        Rx
      `;
      const result = parseMedicineLabel(ocrOutput);
      expect(result.name).toBe('Dapagliflozin (Dapafast)');
      expect(result.dosage).toContain('10 mg');
      expect(result.type).toBe('maintenance');
    });

    it('correctly parses Metformin HCl (Formet) 500 mg from metallic blister', () => {
      const ocrOutput = `
        METFORMIN HYDROCHLORIDE
        FORMET
        500 mg Film-Coated Tablet
        BLOOD GLUCOSE-LOWERING DRUG
        Take with meals
        60 tablets
      `;
      const result = parseMedicineLabel(ocrOutput);
      expect(result.name).toBe('Metformin HCl');
      expect(result.dosage).toContain('500 mg');
      expect(result.type).toBe('maintenance');
      expect(result.timesPerDay).toBe(2);
      expect(result.stock).toBe('60');
    });

    it('correctly parses Multivitamins + Iron (Iberet-Folic 500)', () => {
      const ocrOutput = `
        MULTIVITAMINS + IRON
        IBERET-FOLIC 500
        FILM COATED TABLET
        Ferrous Sulfate 525 mg
        30 tablets
      `;
      const result = parseMedicineLabel(ocrOutput);
      expect(result.name).toBe('Multivitamins + Iron (Iberet-Folic 500)');
      expect(result.dosage).toContain('525 mg');
      expect(result.type).toBe('maintenance');
      expect(result.stock).toBe('30');
    });

    it('correctly parses Vitamin B-Complex (TGP 1-6-12) tiny blister', () => {
      const ocrOutput = `
        TGP
        THIAMINE MONONITRATE
        PYRIDOXINE HYDROCHLORIDE
        CYANOCOBALAMIN
        TGP 1-6-12
        100 mg / 10 mg / 50 mcg
        30 tablets
      `;
      const result = parseMedicineLabel(ocrOutput);
      expect(result.name).toBe('Vitamin B-Complex (TGP)');
      expect(result.type).toBe('maintenance');
      expect(result.stock).toBe('30');
    });

    it('correctly parses raw reflection artifacts from real camera capture of Clopidogrel (75 m5 -> 75 mg)', () => {
      const rawCameraOutput = 'Ap ctimed Le de rebit |i idogrekd Clopidod be 75 m5 Film-Coated Tablet ANTITHRC DTIC 30 tablets';
      const result = parseMedicineLabel(rawCameraOutput);
      expect(result.name).toBe('Clopidogrel (Actimed)');
      expect(result.dosage).toContain('75 mg');
      expect(result.type).toBe('maintenance');
    });

    it('correctly parses raw reflection artifacts from real camera capture of TGP B-Complex', () => {
      const rawCameraOutput = '= TGP N THIAMINE Mon ne FANOCOBA LAA TGP 1612 NE Wurm sn 30 tablets';
      const result = parseMedicineLabel(rawCameraOutput);
      expect(result.name).toBe('Vitamin B-Complex (TGP)');
      expect(result.type).toBe('maintenance');
    });

    it('correctly parses raw reflection artifacts from real camera capture of Metformin Formet (500 m9 -> 500 mg)', () => {
      const rawCameraOutput = 'DRP-1 METFORMIN HYDROCHLORIDE FORMET 500 m9 Film-Coated Tablet Take with meals 60 tablets';
      const result = parseMedicineLabel(rawCameraOutput);
      expect(result.name).toBe('Metformin HCl');
      expect(result.dosage).toContain('500 mg');
      expect(result.type).toBe('maintenance');
    });

    it('correctly parses phone camera capture of Biogesic angled blue foil with optical noise', () => {
      const rawCameraOutput = 'we 2 yar Z al 4 Sommer BlOCESine ey < r ar ur Z. ACER] 101) acy, M9 TABLET 20 tablets';
      const result = parseMedicineLabel(rawCameraOutput);
      expect(result.name).toBe('Biogesic (Paracetamol)');
      expect(result.dosage).toContain('500 mg');
      expect(result.type).toBe('PRN');
    });

    it('correctly parses phone camera capture of Dapagliflozin (Dapafast) red blister strip', () => {
      const rawCameraOutput = 've Ag Dap, Zing] ora AST 10 mg Film-Coated Tablet BLOOD GLUCOSE LOWERING 30 tablets';
      const result = parseMedicineLabel(rawCameraOutput);
      expect(result.name).toBe('Dapagliflozin (Dapafast)');
      expect(result.dosage).toContain('10 mg');
      expect(result.type).toBe('maintenance');
    });

    it('correctly parses phone camera capture of Iberet-Folic 500 red-on-silver blister', () => {
      const rawCameraOutput = 'Ea. % WN 2 ULTIVI 13ON Foc Sul 525 mg IBERET-FOLIC 500 FILM COATED TABLET 30 tablets';
      const result = parseMedicineLabel(rawCameraOutput);
      expect(result.name).toBe('Multivitamins + Iron (Iberet-Folic 500)');
      expect(result.dosage).toContain('525 mg');
      expect(result.type).toBe('maintenance');
    });

    it('correctly parses phone camera capture of Amlodipine Lodibes 5mg from metallic blister', () => {
      const rawCameraOutput = 'AMLO LODIBES 5mg Film-Coated Tablet Antihypertensive 30 tablets';
      const result = parseMedicineLabel(rawCameraOutput);
      expect(result.name).toBe('Amlodipine Besylate');
      expect(result.dosage).toContain('5 mg');
      expect(result.type).toBe('maintenance');
    });
  });

  describe('Local AI Automatic Medicine Bounding Box Detection', () => {
    it('returns a valid normalized bounding box structure in any environment', () => {
      const box = detectMedicineBoundingBox({} as any);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
      expect(box.confidence).toBeGreaterThan(0);
    });
  });
});
