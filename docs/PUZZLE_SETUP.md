# Puzzle Storage Setup Guide

## Overview
This project uses Supabase Storage to handle large puzzle datasets instead of storing them in the database.

## Setup Steps

### 1. Create Storage Bucket in Supabase

1. Go to your Supabase Dashboard
2. Navigate to **Storage** section
3. Click **New Bucket**
4. Name it: `puzzles`
5. Set it to **Public** (so backend can download without auth)
6. Click **Create Bucket**

### 2. Upload Your Puzzle CSV

1. Click on the `puzzles` bucket
2. Click **Upload File**
3. Upload your `lichess_puzzles.csv` file
4. Ensure the file name is exactly: `lichess_puzzles.csv`

### 3. Verify File Access

Get the public URL:
```
https://[your-project-ref].supabase.co/storage/v1/object/public/puzzles/lichess_puzzles.csv
```

Test it in browser - you should see CSV content.

### 4. CSV Format Expected

The CSV should have these columns (case-insensitive):
- `puzzle_id` or `PuzzleId` or `id`
- `rating` or `Rating`
- `moves` or `Moves`
- `fen` or `FEN`
- Any other metadata columns

Example:
```csv
PuzzleId,FEN,Moves,Rating,Themes
00008,r6k/6b1/8/1N6/8/8/7P/7K b - - 0 1,h8g7 b5d6,1482,endgame
```

## How It Works

1. **Server Startup**: Puzzles are loaded into memory from Supabase Storage
2. **Caching**: After first load, puzzles stay in memory (no repeated downloads)
3. **Fast Access**: All puzzle queries happen in-memory (no database calls)
4. **Rating Filter**: Puzzles are filtered by user tier rating ranges

## Benefits

✅ No database size limits
✅ Fast in-memory access
✅ Easy to update (just replace CSV file)
✅ No migration needed
✅ Works with millions of puzzles

## Troubleshooting

### Error: "Failed to download puzzles"
- Check bucket name is exactly `puzzles`
- Check file name is exactly `lichess_puzzles.csv`
- Ensure bucket is set to **Public**

### Error: "No puzzles found in rating range"
- Check CSV has `rating` or `Rating` column
- Verify rating values are numbers
- Check user tier is set correctly

### Memory Issues
If dataset is extremely large (>100MB), consider:
- Filtering puzzles by tier before caching
- Using streaming CSV parser
- Implementing pagination

## API Endpoints

All existing endpoints work the same:
- `GET /api/puzzle` - Get puzzle for user (uses memory cache)
- `POST /api/solo/start` - Start session
- `POST /api/solo/submit-move` - Validate move
- `POST /api/solo/submit` - Complete puzzle

No frontend changes needed!
