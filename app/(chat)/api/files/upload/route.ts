import { NextResponse } from 'next/server';
import { z } from 'zod';
import { writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: 'File size should be less than 5MB',
    })
    // Update the file type based on the kind of files you want to accept
    .refine((file) => ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(file.type), {
      message: 'File type should be JPEG, PNG, GIF, or WebP',
    }),
});

export async function POST(request: Request) {

  if (request.body === null) {
    return new Response('Request body is empty', { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(', ');

      console.error('File validation failed:', errorMessage, 'File type:', file.type, 'File size:', file.size);
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const originalFilename = (formData.get('file') as File).name;
    // Sanitize filename to avoid issues with special characters
    const filename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileBuffer = await file.arrayBuffer();
    
    console.log('Processing file:', originalFilename, '-> sanitized:', filename);

    try {
      const uploadDir = './uploads';

      // Check if upload directory exists and is writable
      try {
        await access(uploadDir, constants.F_OK | constants.W_OK);
      } catch {
        // Directory doesn't exist or isn't writable
        console.error(`Upload directory ${uploadDir} is not accessible or writable`);
        return NextResponse.json({ 
          error: `Upload directory ${uploadDir} is not accessible. Please ensure the directory exists and has proper permissions.` 
        }, { status: 500 });
      }
      
      const filePath = join(uploadDir, filename);
      await writeFile(filePath, Buffer.from(fileBuffer));

      // Create absolute URL for the uploaded file
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      const host = request.headers.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;
      
      const data = {
        url: `${baseUrl}/uploads/${filename}`,
        pathname: filename,
        contentType: file.type,
        size: file.size,
      };

      return NextResponse.json(data);
    } catch (error) {
      console.error('File write error:', error);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 },
    );
  }
}
