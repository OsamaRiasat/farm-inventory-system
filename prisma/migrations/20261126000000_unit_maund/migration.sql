-- Client #23: Rice Husk is received and used in Maund (من), not bags.
ALTER TYPE "Unit" ADD VALUE IF NOT EXISTS 'MAUND';
