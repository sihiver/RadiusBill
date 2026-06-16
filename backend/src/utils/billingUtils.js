// Utility for Billing Calculations

/**
 * Calculates prorate information for Fixed Date billing.
 * 
 * @param {number} fixedDate 1-31
 * @param {number} monthlyPrice The full price for 1 month
 * @returns {object} { proratePrice, prorateDays, nextExpiryDate }
 */
function calculateProrate(fixedDate, monthlyPrice) {
  const now = new Date();
  let nextExpiry = new Date(now.getFullYear(), now.getMonth(), fixedDate);

  // If the target date has already passed this month, or is today, the next expiry is next month
  // Wait, if today is the 10th and fixedDate is the 15th, nextExpiry is 15th of THIS month.
  // If today is the 16th and fixedDate is the 15th, nextExpiry is 15th of NEXT month.
  if (nextExpiry <= now) {
    nextExpiry.setMonth(nextExpiry.getMonth() + 1);
  }

  // To avoid weird times, set time to current time or start of day?
  // Since other logic uses NOW(), let's just use current time on the target date.
  
  const diffTime = nextExpiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Prorate formula: (Price / 30) * diffDays
  let proratePrice = Math.round((monthlyPrice / 30) * diffDays);
  
  // Optionally, round to nearest 100 or 1000. Let's round to nearest 100 for a realistic Indonesian billing.
  proratePrice = Math.round(proratePrice / 100) * 100;

  // Edge case: if prorate is somehow higher than monthly price, cap it.
  // Actually, sometimes the month has 31 days and prorate > monthlyPrice. Let's cap at monthlyPrice.
  if (proratePrice > monthlyPrice) {
    proratePrice = monthlyPrice;
  }

  return {
    proratePrice,
    prorateDays: diffDays,
    nextExpiryDate: nextExpiry
  };
}

function calculateExpiry(validityStr) {
  const now = new Date();
  if (!validityStr) {
    now.setDate(now.getDate() + 30);
    return now;
  }
  
  // Try parsing mikrotik format: 1d, 12h, 30m
  let totalSeconds = 0;
  const regex = /(\d+)\s*([wdhms])/gi;
  let match;
  let matchedMikrotik = false;
  
  while ((match = regex.exec(validityStr)) !== null) {
    matchedMikrotik = true;
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 'w') totalSeconds += val * 7 * 86400;
    else if (unit === 'd') totalSeconds += val * 86400;
    else if (unit === 'h') totalSeconds += val * 3600;
    else if (unit === 'm') totalSeconds += val * 60;
    else if (unit === 's') totalSeconds += val;
  }
  
  if (matchedMikrotik && totalSeconds > 0) {
    return new Date(now.getTime() + totalSeconds * 1000);
  }

  // Fallback to Indonesian words
  const oldMatch = validityStr.match(/(\d+)\s*(Hari|Jam|Menit|Minggu|Bulan)/i);
  if (!oldMatch) {
    now.setDate(now.getDate() + 30);
    return now;
  }
  const [, num, unit] = oldMatch;
  const n = parseInt(num);
  if (/menit/i.test(unit))  return new Date(now.getTime() + n * 60 * 1000);
  if (/jam/i.test(unit))    return new Date(now.getTime() + n * 3600 * 1000);
  if (/minggu/i.test(unit)) return new Date(now.getTime() + n * 7 * 86400 * 1000);
  if (/bulan/i.test(unit))  return new Date(now.getTime() + n * 30 * 86400 * 1000);
  return new Date(now.getTime() + n * 86400 * 1000); // Hari
}

module.exports = {
  calculateProrate,
  calculateExpiry
};
