package com.streamohd.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- Data Classes ---
data class StreamVideo(
    val id: String,
    val title: String,
    val description: String,
    val category: String,
    val duration: String,
    val imageUrl: String,
    val likes: Int
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            StreamoTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF09090B) // zinc-950
                ) {
                    StreamoApp()
                }
            }
        }
    }
}

@Composable
fun StreamoTheme(content: @companion_content composable_block: @Composable () -> Unit) {
    val darkColorScheme = darkColorScheme(
        primary = Color(0xFF3B82F6), // blue-500
        background = Color(0xFF09090B),
        surface = Color(0xFF18181B)
    )
    MaterialTheme(
        colorScheme = darkColorScheme,
        content = composable_block
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StreamoApp() {
    // Media Library
    val videos = remember {
        listOf(
            StreamVideo(
                "1",
                "Cosmic Horizon: Voyage Beyond",
                "Embark on an immersive cinematic voyage through a spectacular nebula, detailing the future of space exploration and stellar charting.",
                "Sci-Fi",
                "2:45",
                "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600",
                342
            ),
            StreamVideo(
                "2",
                "Neon Pulse: Cyber Cityscape",
                "A gorgeous, high-contrast night tour of a fictional sci-fi metropolis, radiating with vibrant neon streams.",
                "Action",
                "1:30",
                "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600",
                218
            ),
            StreamVideo(
                "3",
                "Nature's Whisper: Deep Forest",
                "Rejuvenate with crisp 4K vistas of sunlit streams and majestic redwoods. The ultimate sensory experience.",
                "Nature",
                "3:10",
                "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=600",
                198
            ),
            StreamVideo(
                "4",
                "Midnight Drift: Tokyo Highway",
                "An elegant night-drive video showing dynamic speed, sparkling tail lights, and modern architectures.",
                "Action",
                "2:05",
                "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=600",
                412
            )
        )
    }

    var selectedVideo by remember { mutableStateOf(videos[0]) }
    var selectedCategory by remember { mutableStateOf("All") }
    var showConfigDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF09090B))
    ) {
        // --- Header / Navbar ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                // TV Icon Shape (S + Play outline)
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .background(Color.White, RoundedCornerShape(50))
                        .clickable { },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "S",
                        color = Color(0xFF09090B),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        fontStyle = FontStyle.Italic,
                        fontFamily = FontFamily.Serif
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = "Streamo HD",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "Android TV & Phone Edition",
                        color = Color(0xFFA1A1AA),
                        fontSize = 8.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            IconButton(onClick = { showConfigDialog = true }) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Supabase Config",
                    tint = Color(0xFFA1A1AA)
                )
            }
        }

        // --- Featured Video Banner ---
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(210.dp)
                .padding(horizontal = 16.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF18181B))
        ) {
            // Simulated Backdrop gradient
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color(0xCC09090B), Color(0xFF09090B)),
                            startY = 100f
                        )
                    )
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.Bottom
            ) {
                Box(
                    modifier = Modifier
                        .background(Color(0xFF3B82F6), RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = selectedVideo.category.uppercase(),
                        color = Color.White,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = selectedVideo.title,
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = selectedVideo.description,
                    color = Color(0xFFA1A1AA),
                    fontSize = 11.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 15.sp
                )

                Spacer(modifier = Modifier.height(10.dp))

                Button(
                    onClick = { /* Handle ExoPlayer load */ },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                    modifier = Modifier.height(34.dp),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 0.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play",
                        tint = Color.Black,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "PLAY STREAM",
                        color = Color.Black,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // --- Category Filters Row ---
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val categories = listOf("All", "Sci-Fi", "Action", "Nature", "General")
            items(categories) { cat ->
                val isSelected = selectedCategory == cat
                Box(
                    modifier = Modifier
                        .background(
                            if (isSelected) Color(0xFF3B82F6) else Color(0xFF18181B),
                            RoundedCornerShape(50)
                        )
                        .clickable { selectedCategory = cat }
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Text(
                        text = cat,
                        color = if (isSelected) Color.White else Color(0xFFA1A1AA),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // --- Explorer Grid ---
        Text(
            text = "CINEMA EXPLORER",
            color = Color.White,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 20.dp),
            letterSpacing = 1.sp
        )

        Spacer(modifier = Modifier.height(8.dp))

        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            val filtered = if (selectedCategory == "All") videos else videos.filter { it.category == selectedCategory }
            items(filtered) { video ->
                val isCurrentlySelected = selectedVideo.id == video.id
                Card(
                    onClick = { selectedVideo = video },
                    colors = CardDefaults.cardColors(
                        containerColor = if (isCurrentlySelected) Color(0xFF1E293B) else Color(0xFF18181B)
                    ),
                    modifier = Modifier
                        .width(180.dp)
                        .height(180.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(12.dp),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(85.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color(0xFF27272A)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = "Play Icon",
                                tint = Color.White,
                                modifier = Modifier.size(24.dp)
                            )
                        }

                        Column(modifier = Modifier.padding(top = 6.dp)) {
                            Text(
                                text = video.title,
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = video.description,
                                color = Color(0xFFA1A1AA),
                                fontSize = 9.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = video.category,
                                color = Color(0xFF3B82F6),
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "❤️ ${video.likes}",
                                color = Color(0xFFA1A1AA),
                                fontSize = 8.sp
                            )
                        }
                    }
                }
            }
        }
    }

    // Supabase Configuration Dialog
    if (showConfigDialog) {
        AlertDialog(
            onDismissRequest = { showConfigDialog = false },
            title = {
                Text(
                    text = "Supabase Integration Settings",
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Connect Streamo HD directly to your backend database to receive live student/user stream feeds.",
                        color = Color(0xFFA1A1AA),
                        fontSize = 11.sp
                    )
                    OutlinedTextField(
                        value = "",
                        onValueChange = {},
                        label = { Text("Supabase URL") },
                        placeholder = { Text("https://yourproject.supabase.co") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = "",
                        onValueChange = {},
                        label = { Text("Supabase Anonymous Key") },
                        placeholder = { Text("your_anon_public_key...") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(onClick = { showConfigDialog = false }) {
                    Text("Save Configuration")
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfigDialog = false }) {
                    Text("Cancel")
                }
            },
            containerColor = Color(0xFF18181b)
        )
    }
}
