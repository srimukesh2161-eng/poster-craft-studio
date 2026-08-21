function PosterDisplay({ imageUrl, loading }) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "poster.png";
    link.click();
  };

  if (loading) {
    return (
      <div className="poster-display">
        <div className="poster-skeleton">
          <span className="spinner large"></span>
          <p>Generating your poster...</p>
        </div>
      </div>
    );
  }

  if (!imageUrl) return null;

  return (
    <div className="poster-display">
      <img src={imageUrl} alt="Generated poster" />
      <button className="download-btn" onClick={handleDownload}>Download Poster</button>
    </div>
  );
}

export default PosterDisplay;