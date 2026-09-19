export type DepotClass = 'central' | 'depot' | 'suboperating';

export interface Depot {
  code: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  cls: DepotClass;
  /** Approximate operational jurisdiction radius in km. */
  radiusKm: number;
}

/**
 * KSRTC operates depots out of the towns below. Coordinates are town-level
 * centroids, accurate to roughly a kilometre; in production this table is
 * replaced by the corporation's own depot GIS layer.
 */
export const DEPOTS: Depot[] = [
  { code: 'TVM', name: 'Thiruvananthapuram Central', district: 'Thiruvananthapuram', lat: 8.4875, lng: 76.9525, cls: 'central', radiusKm: 22 },
  { code: 'PRD', name: 'Peroorkada', district: 'Thiruvananthapuram', lat: 8.532, lng: 76.972, cls: 'depot', radiusKm: 18 },
  { code: 'VKB', name: 'Vikas Bhavan', district: 'Thiruvananthapuram', lat: 8.506, lng: 76.949, cls: 'depot', radiusKm: 15 },
  { code: 'KTD', name: 'Kattakkada', district: 'Thiruvananthapuram', lat: 8.409, lng: 77.083, cls: 'depot', radiusKm: 22 },
  { code: 'NDM', name: 'Nedumangad', district: 'Thiruvananthapuram', lat: 8.603, lng: 77.002, cls: 'depot', radiusKm: 22 },
  { code: 'VZJ', name: 'Vizhinjam', district: 'Thiruvananthapuram', lat: 8.379, lng: 77.0, cls: 'suboperating', radiusKm: 18 },
  { code: 'ATL', name: 'Attingal', district: 'Thiruvananthapuram', lat: 8.696, lng: 76.815, cls: 'depot', radiusKm: 22 },
  { code: 'KLM_R', name: 'Kilimanoor', district: 'Thiruvananthapuram', lat: 8.777, lng: 76.872, cls: 'suboperating', radiusKm: 20 },
  { code: 'VRK', name: 'Varkala', district: 'Thiruvananthapuram', lat: 8.734, lng: 76.716, cls: 'depot', radiusKm: 18 },
  { code: 'KLM', name: 'Kollam', district: 'Kollam', lat: 8.8932, lng: 76.6141, cls: 'central', radiusKm: 25 },
  { code: 'CTN', name: 'Chathannoor', district: 'Kollam', lat: 8.84, lng: 76.72, cls: 'suboperating', radiusKm: 16 },
  { code: 'KTR', name: 'Kottarakkara', district: 'Kollam', lat: 9.0, lng: 76.78, cls: 'depot', radiusKm: 24 },
  { code: 'PNL', name: 'Punalur', district: 'Kollam', lat: 9.015, lng: 76.925, cls: 'depot', radiusKm: 28 },
  { code: 'KGP', name: 'Karunagappally', district: 'Kollam', lat: 9.054, lng: 76.535, cls: 'depot', radiusKm: 20 },
  { code: 'ADR', name: 'Adoor', district: 'Pathanamthitta', lat: 9.156, lng: 76.73, cls: 'depot', radiusKm: 22 },
  { code: 'PTA', name: 'Pathanamthitta', district: 'Pathanamthitta', lat: 9.2648, lng: 76.787, cls: 'depot', radiusKm: 24 },
  { code: 'TVL', name: 'Thiruvalla', district: 'Pathanamthitta', lat: 9.383, lng: 76.574, cls: 'depot', radiusKm: 20 },
  { code: 'RNI', name: 'Ranni', district: 'Pathanamthitta', lat: 9.383, lng: 76.785, cls: 'depot', radiusKm: 24 },
  { code: 'KNI', name: 'Konni', district: 'Pathanamthitta', lat: 9.227, lng: 76.845, cls: 'suboperating', radiusKm: 22 },
  { code: 'MLP', name: 'Mallappally', district: 'Pathanamthitta', lat: 9.44, lng: 76.66, cls: 'suboperating', radiusKm: 18 },
  { code: 'ALP', name: 'Alappuzha', district: 'Alappuzha', lat: 9.4981, lng: 76.3388, cls: 'central', radiusKm: 22 },
  { code: 'CHL', name: 'Cherthala', district: 'Alappuzha', lat: 9.684, lng: 76.336, cls: 'depot', radiusKm: 20 },
  { code: 'CGR', name: 'Chengannur', district: 'Alappuzha', lat: 9.316, lng: 76.615, cls: 'depot', radiusKm: 18 },
  { code: 'HRP', name: 'Haripad', district: 'Alappuzha', lat: 9.287, lng: 76.457, cls: 'depot', radiusKm: 18 },
  { code: 'MVK', name: 'Mavelikkara', district: 'Alappuzha', lat: 9.256, lng: 76.548, cls: 'depot', radiusKm: 18 },
  { code: 'KYK', name: 'Kayamkulam', district: 'Alappuzha', lat: 9.178, lng: 76.501, cls: 'depot', radiusKm: 18 },
  { code: 'KTM', name: 'Kottayam', district: 'Kottayam', lat: 9.5916, lng: 76.5222, cls: 'central', radiusKm: 22 },
  { code: 'CGY', name: 'Changanassery', district: 'Kottayam', lat: 9.445, lng: 76.539, cls: 'depot', radiusKm: 18 },
  { code: 'ETM', name: 'Ettumanoor', district: 'Kottayam', lat: 9.67, lng: 76.558, cls: 'suboperating', radiusKm: 16 },
  { code: 'PAL', name: 'Pala', district: 'Kottayam', lat: 9.71, lng: 76.683, cls: 'depot', radiusKm: 22 },
  { code: 'VKM', name: 'Vaikom', district: 'Kottayam', lat: 9.748, lng: 76.396, cls: 'depot', radiusKm: 20 },
  { code: 'ERP', name: 'Erattupetta', district: 'Kottayam', lat: 9.688, lng: 76.777, cls: 'suboperating', radiusKm: 20 },
  { code: 'KJP', name: 'Kanjirappally', district: 'Kottayam', lat: 9.558, lng: 76.79, cls: 'depot', radiusKm: 24 },
  { code: 'PKM', name: 'Ponkunnam', district: 'Kottayam', lat: 9.58, lng: 76.77, cls: 'suboperating', radiusKm: 18 },
  { code: 'TDP', name: 'Thodupuzha', district: 'Idukki', lat: 9.895, lng: 76.718, cls: 'depot', radiusKm: 26 },
  { code: 'KTP', name: 'Kattappana', district: 'Idukki', lat: 9.75, lng: 77.116, cls: 'depot', radiusKm: 30 },
  { code: 'MUN', name: 'Munnar', district: 'Idukki', lat: 10.0889, lng: 77.0595, cls: 'depot', radiusKm: 35 },
  { code: 'NDK', name: 'Nedumkandam', district: 'Idukki', lat: 9.84, lng: 77.156, cls: 'suboperating', radiusKm: 26 },
  { code: 'IDK', name: 'Painavu (Idukki)', district: 'Idukki', lat: 9.849, lng: 76.972, cls: 'suboperating', radiusKm: 26 },
  { code: 'EKM', name: 'Ernakulam', district: 'Ernakulam', lat: 9.9816, lng: 76.2999, cls: 'central', radiusKm: 22 },
  { code: 'ALV', name: 'Aluva', district: 'Ernakulam', lat: 10.1076, lng: 76.3516, cls: 'depot', radiusKm: 18 },
  { code: 'PBR', name: 'Perumbavoor', district: 'Ernakulam', lat: 10.107, lng: 76.475, cls: 'depot', radiusKm: 20 },
  { code: 'MVP', name: 'Muvattupuzha', district: 'Ernakulam', lat: 9.981, lng: 76.578, cls: 'depot', radiusKm: 22 },
  { code: 'KTG', name: 'Kothamangalam', district: 'Ernakulam', lat: 10.059, lng: 76.635, cls: 'depot', radiusKm: 24 },
  { code: 'PVM', name: 'Piravom', district: 'Ernakulam', lat: 9.869, lng: 76.489, cls: 'suboperating', radiusKm: 18 },
  { code: 'NPR', name: 'North Paravur', district: 'Ernakulam', lat: 10.144, lng: 76.229, cls: 'depot', radiusKm: 18 },
  { code: 'AGY', name: 'Angamaly', district: 'Ernakulam', lat: 10.196, lng: 76.386, cls: 'depot', radiusKm: 18 },
  { code: 'TSR', name: 'Thrissur', district: 'Thrissur', lat: 10.5276, lng: 76.2144, cls: 'central', radiusKm: 22 },
  { code: 'CKD', name: 'Chalakudy', district: 'Thrissur', lat: 10.308, lng: 76.334, cls: 'depot', radiusKm: 20 },
  { code: 'IJK', name: 'Irinjalakuda', district: 'Thrissur', lat: 10.343, lng: 76.213, cls: 'depot', radiusKm: 18 },
  { code: 'KDG', name: 'Kodungallur', district: 'Thrissur', lat: 10.226, lng: 76.194, cls: 'depot', radiusKm: 18 },
  { code: 'GVR', name: 'Guruvayur', district: 'Thrissur', lat: 10.594, lng: 76.041, cls: 'depot', radiusKm: 18 },
  { code: 'KNK', name: 'Kunnamkulam', district: 'Thrissur', lat: 10.65, lng: 76.07, cls: 'depot', radiusKm: 18 },
  { code: 'WDK', name: 'Wadakkanchery', district: 'Thrissur', lat: 10.647, lng: 76.24, cls: 'suboperating', radiusKm: 18 },
  { code: 'PGT', name: 'Palakkad', district: 'Palakkad', lat: 10.7867, lng: 76.6548, cls: 'central', radiusKm: 24 },
  { code: 'CTR', name: 'Chittur', district: 'Palakkad', lat: 10.7, lng: 76.747, cls: 'depot', radiusKm: 20 },
  { code: 'ALT', name: 'Alathur', district: 'Palakkad', lat: 10.644, lng: 76.551, cls: 'suboperating', radiusKm: 20 },
  { code: 'MKD', name: 'Mannarkkad', district: 'Palakkad', lat: 10.99, lng: 76.466, cls: 'depot', radiusKm: 26 },
  { code: 'OTP', name: 'Ottapalam', district: 'Palakkad', lat: 10.77, lng: 76.377, cls: 'depot', radiusKm: 20 },
  { code: 'PTB', name: 'Pattambi', district: 'Palakkad', lat: 10.807, lng: 76.197, cls: 'suboperating', radiusKm: 18 },
  { code: 'SRR', name: 'Shoranur', district: 'Palakkad', lat: 10.76, lng: 76.27, cls: 'suboperating', radiusKm: 16 },
  { code: 'MPM', name: 'Malappuram', district: 'Malappuram', lat: 11.051, lng: 76.074, cls: 'depot', radiusKm: 22 },
  { code: 'PMN', name: 'Perinthalmanna', district: 'Malappuram', lat: 10.976, lng: 76.227, cls: 'depot', radiusKm: 22 },
  { code: 'PNN', name: 'Ponnani', district: 'Malappuram', lat: 10.769, lng: 75.925, cls: 'depot', radiusKm: 20 },
  { code: 'TRR', name: 'Tirur', district: 'Malappuram', lat: 10.913, lng: 75.922, cls: 'depot', radiusKm: 20 },
  { code: 'NLB', name: 'Nilambur', district: 'Malappuram', lat: 11.276, lng: 76.226, cls: 'depot', radiusKm: 28 },
  { code: 'MJR', name: 'Manjeri', district: 'Malappuram', lat: 11.12, lng: 76.12, cls: 'depot', radiusKm: 20 },
  { code: 'EDP', name: 'Edappal', district: 'Malappuram', lat: 10.78, lng: 76.0, cls: 'suboperating', radiusKm: 16 },
  { code: 'KKD', name: 'Kozhikode', district: 'Kozhikode', lat: 11.2588, lng: 75.7804, cls: 'central', radiusKm: 24 },
  { code: 'VDK', name: 'Vadakara', district: 'Kozhikode', lat: 11.608, lng: 75.593, cls: 'depot', radiusKm: 22 },
  { code: 'TMR', name: 'Thamarassery', district: 'Kozhikode', lat: 11.415, lng: 75.937, cls: 'depot', radiusKm: 24 },
  { code: 'KYL', name: 'Koyilandy', district: 'Kozhikode', lat: 11.44, lng: 75.698, cls: 'depot', radiusKm: 18 },
  { code: 'SBY', name: 'Sulthan Bathery', district: 'Wayanad', lat: 11.664, lng: 76.26, cls: 'depot', radiusKm: 30 },
  { code: 'KLP', name: 'Kalpetta', district: 'Wayanad', lat: 11.608, lng: 76.083, cls: 'depot', radiusKm: 28 },
  { code: 'MND', name: 'Mananthavady', district: 'Wayanad', lat: 11.802, lng: 76.001, cls: 'depot', radiusKm: 30 },
  { code: 'KNR', name: 'Kannur', district: 'Kannur', lat: 11.8745, lng: 75.3704, cls: 'central', radiusKm: 22 },
  { code: 'TLY', name: 'Thalassery', district: 'Kannur', lat: 11.748, lng: 75.492, cls: 'depot', radiusKm: 20 },
  { code: 'PYN', name: 'Payyanur', district: 'Kannur', lat: 12.104, lng: 75.202, cls: 'depot', radiusKm: 22 },
  { code: 'TLP', name: 'Thaliparamba', district: 'Kannur', lat: 12.04, lng: 75.36, cls: 'depot', radiusKm: 20 },
  { code: 'IRT', name: 'Iritty', district: 'Kannur', lat: 11.98, lng: 75.7, cls: 'suboperating', radiusKm: 26 },
  { code: 'KSD', name: 'Kasaragod', district: 'Kasaragod', lat: 12.4996, lng: 74.9869, cls: 'depot', radiusKm: 24 },
  { code: 'KNG', name: 'Kanhangad', district: 'Kasaragod', lat: 12.312, lng: 75.089, cls: 'depot', radiusKm: 22 },
];

export interface Corridor {
  id: string;
  name: string;
  /** Ordered depot codes the corridor runs through. */
  via: string[];
  /** Approximate daily passengers, used only for priority weighting. */
  dailyPax: number;
}

export const CORRIDORS: Corridor[] = [
  { id: 'C1', name: 'Thiruvananthapuram – Kollam – Alappuzha – Ernakulam (NH 66 coastal)', via: ['TVM', 'ATL', 'VRK', 'KLM', 'KGP', 'HRP', 'ALP', 'CHL', 'EKM'], dailyPax: 41000 },
  { id: 'C2', name: 'Thiruvananthapuram – Kottarakkara – Kottayam – Ernakulam (MC Road)', via: ['TVM', 'ATL', 'KTR', 'ADR', 'TVL', 'CGY', 'KTM', 'ETM', 'MVP', 'EKM'], dailyPax: 38000 },
  { id: 'C3', name: 'Ernakulam – Angamaly – Thrissur – Palakkad', via: ['EKM', 'ALV', 'AGY', 'CKD', 'TSR', 'WDK', 'PGT'], dailyPax: 33000 },
  { id: 'C4', name: 'Thrissur – Kunnamkulam – Tirur – Kozhikode', via: ['TSR', 'KNK', 'EDP', 'TRR', 'KKD'], dailyPax: 24000 },
  { id: 'C5', name: 'Kozhikode – Thamarassery – Kalpetta – Sulthan Bathery (Churam ghat)', via: ['KKD', 'TMR', 'KLP', 'SBY'], dailyPax: 17000 },
  { id: 'C6', name: 'Kozhikode – Koyilandy – Vadakara – Thalassery – Kannur', via: ['KKD', 'KYL', 'VDK', 'TLY', 'KNR'], dailyPax: 26000 },
  { id: 'C7', name: 'Kannur – Thaliparamba – Payyanur – Kanhangad – Kasaragod', via: ['KNR', 'TLP', 'PYN', 'KNG', 'KSD'], dailyPax: 15000 },
  { id: 'C8', name: 'Ernakulam – Muvattupuzha – Thodupuzha – Munnar (ghat section)', via: ['EKM', 'MVP', 'TDP', 'IDK', 'MUN'], dailyPax: 12000 },
  { id: 'C9', name: 'Kottayam – Kanjirappally – Kattappana – Nedumkandam', via: ['KTM', 'PAL', 'KJP', 'KTP', 'NDK'], dailyPax: 9000 },
  { id: 'C10', name: 'Kollam – Punalur – Pathanamthitta – Ranni (Sabarimala approach)', via: ['KLM', 'KTR', 'PNL', 'KNI', 'PTA', 'RNI'], dailyPax: 11000 },
  { id: 'C11', name: 'Palakkad – Mannarkkad – Perinthalmanna – Malappuram – Kozhikode', via: ['PGT', 'MKD', 'PMN', 'MPM', 'KKD'], dailyPax: 14000 },
  { id: 'C12', name: 'Thiruvananthapuram – Nedumangad – Punalur (hill route)', via: ['TVM', 'NDM', 'PNL'], dailyPax: 8000 },
];

/** Corridors that run along national highways, where NHAI owns the carriageway. */
export const NH_CORRIDOR_IDS = new Set(['C1', 'C3', 'C4', 'C6', 'C7']);

export const DEPOT_BY_CODE: Record<string, Depot> = Object.fromEntries(
  DEPOTS.map((d) => [d.code, d]),
);
